import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentOrchestrator } from "./orchestrator.js";
import { Task, TaskState } from "../core/tasks/index.js";

const mocks = vi.hoisted(() => {
  const mockListTaskStream = vi.fn();
  const mockListTasks = vi.fn();
  const mockAssignTask = vi.fn();
  const mockUnassignTask = vi.fn();
  const mockWorktreeCreate = vi.fn();
  const mockWorktreeRemove = vi.fn();
  const mockInstanceCreate = vi.fn();
  const mockInstanceRemove = vi.fn();
  const mockStopAllAgentInstances = vi.fn();
  const mockSendMessage = vi.fn();
  const mockGetAgentInstance = vi.fn();
  const mockGlobalEvent = vi.fn();
  const mockGetOrCreateSession = vi.fn();
  
  class MockTaskManager {
    listTaskStream = mockListTaskStream;
    listTasks = mockListTasks;
    assignTask = mockAssignTask;
    unassignTask = mockUnassignTask;
  }
  
  class MockAgentInstanceManager {
    createAgentInstance = mockInstanceCreate;
    removeAgentInstance = mockInstanceRemove;
    stopAllAgentInstances = mockStopAllAgentInstances;
    sendMessage = mockSendMessage;
    getAgentInstance = mockGetAgentInstance;
    onAgentInstanceIdle = vi.fn();
  }

  class MockSessionRepository {
    getOrCreateSession = mockGetOrCreateSession;
  }
  
  return {
    mockListTaskStream,
    mockListTasks,
    mockAssignTask,
    mockUnassignTask,
    mockWorktreeCreate,
    mockWorktreeRemove,
    mockInstanceCreate,
    mockInstanceRemove,
    mockStopAllAgentInstances,
    mockSendMessage,
    mockGetAgentInstance,
    mockGlobalEvent,
    mockGetOrCreateSession,
    MockTaskManager,
    MockAgentInstanceManager,
    MockSessionRepository,
  };
});

vi.mock("dyson-swarm", () => ({
  TaskManager: mocks.MockTaskManager,
}));

vi.mock("../core/git/worktrees/index.js", () => ({
  WorktreeManager: class MockWorktreeManager {
    create = vi.fn();
    remove = vi.fn();
    list = vi.fn();
    prune = vi.fn();
    getWorktreePath = vi.fn();
    isWorktree = vi.fn();
  },
}));

vi.mock("../config/paths.js", () => ({
  getWorktreesDir: () => "/test/worktrees",
  getOrchidDir: () => "/test/.orchid",
}));

vi.mock("./session-repository.js", () => ({
  createSessionRepository: () => new mocks.MockSessionRepository(),
  AgentType: {
    IMPLEMENTOR: "implementor",
    REVIEWER: "reviewer",
    MERGER: "merger",
  },
}));

describe("AgentOrchestrator", () => {
  let orchestrator: AgentOrchestrator;
  let mockWorktreeManager: any;
  let mockAgentInstanceManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockWorktreeManager = {
      create: mocks.mockWorktreeCreate,
      remove: mocks.mockWorktreeRemove,
      list: vi.fn(),
      prune: vi.fn(),
      getWorktreePath: vi.fn(),
      isWorktree: vi.fn(),
    };
    mockAgentInstanceManager = {
      createAgentInstance: mocks.mockInstanceCreate,
      removeAgentInstance: mocks.mockInstanceRemove,
      stopAllAgentInstances: mocks.mockStopAllAgentInstances,
      sendMessage: mocks.mockSendMessage,
      getAgentInstance: mocks.mockGetAgentInstance,
      onAgentInstanceIdle: vi.fn(),
    };
    
    // Default mock for getOrCreateSession
    mocks.mockGetOrCreateSession.mockReturnValue({
      taskId: "task-1",
      agentType: "implementor",
      version: 1,
      filename: "implementor-1",
      filePath: "/test/.orchid/sessions/task-1/implementor-1.json",
    });
    
    mocks.mockListTasks.mockResolvedValue([]);
    mocks.mockSendMessage.mockResolvedValue(undefined);
    mocks.mockAssignTask.mockResolvedValue(undefined);
    mocks.mockUnassignTask.mockResolvedValue(undefined);
    
    orchestrator = new AgentOrchestrator({ 
      worktreeManager: mockWorktreeManager,
      agentInstanceManager: mockAgentInstanceManager,
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
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      await orchestrator.stop();

      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  describe("task lifecycle", () => {
    it("should create a task for a new open task", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      // Task should have been created and an implementor should exist
      const agents = orchestrator.getRunningAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0]).toMatchObject({
        taskId: "task-1",
        agentId: "task-1-implementor",
        state: TaskState.IMPLEMENTING,
      });
    });

    it("should not start duplicate implementors for the same task", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
      mocks.mockWorktreeCreate.mockResolvedValue(true);

      const task = { id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" };
      const streamIterator = (async function* () {
        yield [task];
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      // Should only create one worktree
      expect(mocks.mockWorktreeCreate).toHaveBeenCalledTimes(1);
    });

    it("should cleanup tasks that are no longer open", async () => {
      mocks.mockWorktreeCreate.mockResolvedValue(true);
      mocks.mockWorktreeRemove.mockResolvedValue(true);
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(orchestrator.getRunningAgents()).toHaveLength(0);
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

  describe("task state machine", () => {
    it("should transition task from PENDING_IMPLEMENTATION to IMPLEMENTING", async () => {
      const task = new Task({
        taskId: "task-test",
        dysonTask: { id: "task-test", frontmatter: { title: "Test" }, description: "", status: "open" },
      });

      expect(task.state).toBe(TaskState.PENDING_IMPLEMENTATION);
      task.assignImplementor("implementor-1");
      expect(task.state).toBe(TaskState.IMPLEMENTING);
    });

    it("should transition task from IMPLEMENTING to AWAITING_REVIEW", async () => {
      const task = new Task({
        taskId: "task-test",
        dysonTask: { id: "task-test", frontmatter: { title: "Test" }, description: "", status: "open" },
      });

      task.assignImplementor("implementor-1");
      task.markImplementationComplete();
      expect(task.state).toBe(TaskState.AWAITING_REVIEW);
    });

    it("should not allow invalid state transitions", async () => {
      const task = new Task({
        taskId: "task-test",
        dysonTask: { id: "task-test", frontmatter: { title: "Test" }, description: "", status: "open" },
      });

      expect(() => task.markImplementationComplete()).toThrow();
    });
  });

});
