import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentOrchestrator } from "./agent-orchestrator";

const mocks = vi.hoisted(() => {
  const mockListTaskStream = vi.fn();
  const mockListTasks = vi.fn();
  const mockAssignTask = vi.fn();
  const mockUnassignTask = vi.fn();
  const mockWorktreeCreate = vi.fn();
  const mockWorktreeRemove = vi.fn();
  const mockWorktreeList = vi.fn();
  const mockSessionCreate = vi.fn();
  const mockSessionRemove = vi.fn();
  const mockSessionStopAll = vi.fn();
  const mockHasSession = vi.fn();
  const mockGetSession = vi.fn();
  const mockRecoverSessions = vi.fn();
  
  class MockTaskManager {
    listTaskStream = mockListTaskStream;
    list = mockListTasks;
    assignTask = mockAssignTask;
    unassignTask = mockUnassignTask;
  }
  
  class MockSessionManager {
    createSession = mockSessionCreate;
    removeSession = mockSessionRemove;
    stopAllSessions = mockSessionStopAll;
    hasSession = mockHasSession;
    getSession = mockGetSession;
    recoverSessions = mockRecoverSessions;
  }
  
  return {
    mockListTaskStream,
    mockListTasks,
    mockAssignTask,
    mockUnassignTask,
    mockWorktreeCreate,
    mockWorktreeRemove,
    mockWorktreeList,
    mockSessionCreate,
    mockSessionRemove,
    mockSessionStopAll,
    mockHasSession,
    mockGetSession,
    mockRecoverSessions,
    MockTaskManager,
    MockSessionManager,
  };
});

vi.mock("dyson-swarm", () => ({
  TaskManager: mocks.MockTaskManager,
}));

vi.mock("./worktrees/index.js", () => ({
  WorktreeManager: class MockWorktreeManager {
    create = vi.fn();
    remove = vi.fn();
    list = vi.fn();
    prune = vi.fn();
    getWorktreePath = vi.fn();
    isWorktree = vi.fn();
  },
}));

vi.mock("./paths.js", () => ({
  getWorktreesDir: (cwdProvider?: () => string) => "/test/worktrees",
}));

vi.mock("./opencode-session.js", () => ({
  OpencodeSessionManager: mocks.MockSessionManager,
}));

describe("AgentOrchestrator", () => {
  let orchestrator: AgentOrchestrator;
  let mockWorktreeManager: any;
  let mockSessionManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockWorktreeManager = {
      create: mocks.mockWorktreeCreate,
      remove: mocks.mockWorktreeRemove,
      list: mocks.mockWorktreeList,
      prune: vi.fn(),
      getWorktreePath: vi.fn(),
      isWorktree: vi.fn(),
    };
    mockSessionManager = {
      createSession: mocks.mockSessionCreate,
      removeSession: mocks.mockSessionRemove,
      stopAllSessions: mocks.mockSessionStopAll,
      hasSession: mocks.mockHasSession,
      getSession: mocks.mockGetSession,
      recoverSessions: mocks.mockRecoverSessions,
    };
    mocks.mockRecoverSessions.mockResolvedValue([]);
    mocks.mockListTasks.mockResolvedValue([]);
    orchestrator = new AgentOrchestrator({ 
      worktreeManager: mockWorktreeManager,
      sessionManager: mockSessionManager,
      opencodeBaseUrl: "http://localhost:4096",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should start monitoring tasks", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      const startPromise = orchestrator.start();

      await vi.runAllTimersAsync();
      await startPromise;

      expect(mocks.mockListTaskStream).toHaveBeenCalledWith({ status: "open" });
    });

    it("should not start if already running", async () => {
      const streamIterator = (async function* () {
        yield [];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();

      await vi.runAllTimersAsync();

      orchestrator.start();

      expect(mocks.mockListTaskStream).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should stop the orchestrator", async () => {
      const streamIterator = (async function* () {
        yield [];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      await orchestrator.stop();

      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should stop all running agents", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-stop",
        taskId: "task-stop",
        workingDirectory: "/test/worktrees/task-stop",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(orchestrator.getRunningAgents()).toHaveLength(1);

      await orchestrator.stop();

      expect(orchestrator.getRunningAgents()).toHaveLength(0);
      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-1");
    });
  });

  describe("agent lifecycle", () => {
    it("should start an agent for a new open task", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
      expect(orchestrator.getRunningAgents()[0]).toMatchObject({
        taskId: "task-1",
        agentId: "task-1-implementor",
        status: "running",
      });
    });

    it("should not start duplicate agents for the same task", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const task = { id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" };
      const streamIterator = (async function* () {
        yield [task];
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledTimes(1);
      expect(mocks.mockWorktreeCreate).toHaveBeenCalledTimes(1);
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
    });

    it("should stop an agent when task is no longer open", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-1");
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should handle multiple tasks", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-test",
        taskId: "task-test",
        workingDirectory: "/test/worktrees/task-test",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [
          { id: "task-1", frontmatter: { title: "Test 1" }, description: "", status: "open" },
          { id: "task-2", frontmatter: { title: "Test 2" }, description: "", status: "open" },
        ];
        yield [{ id: "task-1", frontmatter: { title: "Test 1" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-2", "task-2-implementor");
      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-2");
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
    });
  });

  describe("worktree management", () => {
    it("should create a worktree when starting an agent", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-123",
        taskId: "task-123",
        workingDirectory: "/test/worktrees/task-123",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-123", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockWorktreeCreate).toHaveBeenCalledWith(
        "/test/worktrees/task-123",
        "HEAD",
        { detach: true }
      );
      expect(orchestrator.getRunningAgents()[0].worktreePath).toBe(
        "/test/worktrees/task-123"
      );
    });

    it("should remove the worktree when stopping an agent", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-123",
        taskId: "task-123",
        workingDirectory: "/test/worktrees/task-123",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-123", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockWorktreeRemove).toHaveBeenCalledWith(
        "/test/worktrees/task-123",
        { force: true }
      );
    });

    it("should force remove worktree even if dirty", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-456",
        taskId: "task-456",
        workingDirectory: "/test/worktrees/task-456",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-456", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockWorktreeRemove).toHaveBeenCalledWith(
        expect.any(String),
        { force: true }
      );
    });

    it("should continue unassigning task even if worktree removal fails", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockRejectedValue(new Error("Failed to remove worktree"));
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-789",
        taskId: "task-789",
        workingDirectory: "/test/worktrees/task-789",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-789", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-789");
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should not start agent if worktree creation fails", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockRejectedValue(new Error("Failed to create worktree"));

      const streamIterator = (async function* () {
        yield [{ id: "task-fail", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).not.toHaveBeenCalled();
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should create unique worktree paths for different tasks", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-alpha",
        taskId: "task-alpha",
        workingDirectory: "/test/worktrees/task-alpha",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [
          { id: "task-alpha", frontmatter: { title: "Alpha" }, description: "", status: "open" },
          { id: "task-beta", frontmatter: { title: "Beta" }, description: "", status: "open" },
        ];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      const agents = orchestrator.getRunningAgents();
      const worktreePaths = agents.map((a) => a.worktreePath);
      expect(new Set(worktreePaths).size).toBe(2);
      expect(worktreePaths).toContain("/test/worktrees/task-alpha");
      expect(worktreePaths).toContain("/test/worktrees/task-beta");
    });
  });

  describe("getRunningAgents", () => {
    it("should return empty array when no agents running", () => {
      expect(orchestrator.getRunningAgents()).toEqual([]);
    });
  });

  describe("isRunning", () => {
    it("should return false when not started", () => {
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should return true when started", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(orchestrator.isRunning()).toBe(true);
    });
  });

  describe("session management", () => {
    it("should create OpenCode session when starting an agent", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-123",
        taskId: "task-session",
        workingDirectory: "/test/worktrees/task-session",
        client: {},
        createdAt: new Date(),
        status: "running",
      });

      const streamIterator = (async function* () {
        yield [{ id: "task-session", frontmatter: { title: "Test Session" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockSessionCreate).toHaveBeenCalledWith("task-session");

      const agents = orchestrator.getRunningAgents();
      expect(agents[0].session).toBeDefined();
      expect(agents[0].session?.sessionId).toBe("session-123");
    });

    it("should remove OpenCode session when stopping an agent", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-stop",
        taskId: "task-stop",
        workingDirectory: "/test/worktrees/task-stop",
        client: {},
        createdAt: new Date(),
        status: "running",
      });
      mocks.mockSessionRemove.mockResolvedValue(undefined);

      const streamIterator = (async function* () {
        yield [{ id: "task-stop", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockSessionRemove).toHaveBeenCalledWith("task-stop");
    });

    it("should not start agent if session creation fails", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockSessionCreate.mockRejectedValue(new Error("Session creation failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const streamIterator = (async function* () {
        yield [{ id: "task-fail-session", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      // Agent should NOT start when session creation fails
      expect(orchestrator.getRunningAgents()).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it("should continue agent cleanup even if session removal fails", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-fail-remove",
        taskId: "task-fail-remove",
        workingDirectory: "/test/worktrees/task-fail-remove",
        client: {},
        createdAt: new Date(),
        status: "running",
      });
      mocks.mockSessionRemove.mockRejectedValue(new Error("Session removal failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const streamIterator = (async function* () {
        yield [{ id: "task-fail-remove", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      // Should log error but continue
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to remove OpenCode session"),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it("should stop all sessions when orchestrator stops", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue({
        sessionId: "session-stop-all",
        taskId: "task-stop-all",
        workingDirectory: "/test/worktrees/task-stop-all",
        client: {},
        createdAt: new Date(),
        status: "running",
      });
      mocks.mockSessionStopAll.mockResolvedValue(undefined);

      const streamIterator = (async function* () {
        yield [{ id: "task-stop-all", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      await orchestrator.stop();

      expect(mocks.mockSessionStopAll).toHaveBeenCalled();
    });

    it("should include session info in running agents", async () => {
      const mockSession = {
        sessionId: "session-info",
        taskId: "task-info",
        workingDirectory: "/test/worktrees/task-info",
        client: {},
        createdAt: new Date("2024-01-01"),
        status: "running" as const,
      };

      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockSessionCreate.mockResolvedValue(mockSession);

      const streamIterator = (async function* () {
        yield [{ id: "task-info", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      const agents = orchestrator.getRunningAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0]).toMatchObject({
        taskId: "task-info",
        agentId: "task-info-implementor",
        status: "running",
        worktreePath: "/test/worktrees/task-info",
        session: mockSession,
      });
    });
  });
});
