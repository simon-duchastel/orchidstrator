import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createImplementorAgent } from "./implementor.js";

const mocks = vi.hoisted(() => {
  const mockSessionCreate = vi.fn();
  const mockSessionRemove = vi.fn();
  const mockSendMessage = vi.fn();
  const mockAssignTask = vi.fn();
  const mockUnassignTask = vi.fn();

  class MockSessionManager {
    createSession = mockSessionCreate;
    removeSession = mockSessionRemove;
    sendMessage = mockSendMessage;
  }

  class MockTaskManager {
    assignTask = mockAssignTask;
    unassignTask = mockUnassignTask;
  }

  return {
    mockSessionCreate,
    mockSessionRemove,
    mockSendMessage,
    mockAssignTask,
    mockUnassignTask,
    MockSessionManager,
    MockTaskManager,
  };
});

vi.mock("../../templates/index.js", () => ({
  fillImplementorAgentPromptTemplate: vi.fn(() => "test prompt"),
  getImplementorSystemPrompt: vi.fn(() => "implementor system prompt"),
}));

describe("ImplementorAgent", () => {
  let mockSessionManager: any;
  let mockTaskManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionManager = new mocks.MockSessionManager();
    mockTaskManager = new mocks.MockTaskManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should create session with implementor system prompt", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockSessionCreate).toHaveBeenCalledWith({
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        systemPrompt: "implementor system prompt",
      });
    });

    it("should assign task in dyson-swarm", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
    });

    it("should send initial prompt after creating session", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockSendMessage).toHaveBeenCalledWith(
        "session-1",
        "test prompt",
        "/test/worktrees/task-1"
      );
    });

    it("should call onError if session creation fails", async () => {
      mocks.mockSessionCreate.mockRejectedValue(new Error("Session creation failed"));
      const onErrorMock = vi.fn();

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: onErrorMock,
      });

      await agent.start();

      expect(onErrorMock).toHaveBeenCalledWith("task-1", expect.any(Error));
      expect(agent.isRunning()).toBe(false);
    });
  });

  describe("stop", () => {
    it("should remove session when stopped", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockSessionRemove.mockResolvedValue(undefined);

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();
      expect(agent.isRunning()).toBe(true);

      await agent.stop();

      expect(mocks.mockSessionRemove).toHaveBeenCalledWith("task-1");
      expect(agent.isRunning()).toBe(false);
    });

    it("should not fail if stopped when not running", async () => {
      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe("handleSessionIdle", () => {
    it("should remove session and call onComplete", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockSessionRemove.mockResolvedValue(undefined);
      const onCompleteMock = vi.fn();

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: onCompleteMock,
        onError: vi.fn(),
      });

      await agent.start();

      await (agent as any).handleSessionIdle();

      expect(mocks.mockSessionRemove).toHaveBeenCalledWith("task-1");
      expect(onCompleteMock).toHaveBeenCalledWith("task-1");
      expect(agent.isRunning()).toBe(false);
    });
  });

  describe("isRunning", () => {
    it("should return false before start", () => {
      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      expect(agent.isRunning()).toBe(false);
    });

    it("should return true after start", async () => {
      const mockSession = {
        sessionId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockSession);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        sessionManager: mockSessionManager,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(agent.isRunning()).toBe(true);
    });
  });
});
