import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createImplementorAgent } from "./implementor.js";
import { AgentType } from "../session-repository.js";

const mocks = vi.hoisted(() => {
  const mockInstanceCreate = vi.fn();
  const mockInstanceRemove = vi.fn();
  const mockSendMessage = vi.fn();
  const mockAssignTask = vi.fn();
  const mockUnassignTask = vi.fn();
  const mockGetOrCreateSession = vi.fn();

  class MockAgentInstanceManager {
    createAgentInstance = mockInstanceCreate;
    removeAgentInstance = mockInstanceRemove;
    sendMessage = mockSendMessage;
  }

  class MockTaskManager {
    assignTask = mockAssignTask;
    unassignTask = mockUnassignTask;
  }

  class MockSessionRepository {
    getOrCreateSession = mockGetOrCreateSession;
  }

  return {
    mockInstanceCreate,
    mockInstanceRemove,
    mockSendMessage,
    mockAssignTask,
    mockUnassignTask,
    mockGetOrCreateSession,
    MockAgentInstanceManager,
    MockTaskManager,
    MockSessionRepository,
  };
});

vi.mock("../../templates/index.js", () => ({
  fillImplementorAgentPromptTemplate: vi.fn(() => "test prompt"),
  getImplementorSystemPrompt: vi.fn(() => "implementor system prompt"),
}));

describe("ImplementorAgent", () => {
  let mockAgentInstanceManager: any;
  let mockTaskManager: any;
  let mockSessionRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentInstanceManager = new mocks.MockAgentInstanceManager();
    mockTaskManager = new mocks.MockTaskManager();
    mockSessionRepository = new mocks.MockSessionRepository();
    
    // Default mock for getOrCreateSession
    mocks.mockGetOrCreateSession.mockReturnValue({
      taskId: "task-1",
      agentType: AgentType.IMPLEMENTOR,
      version: 1,
      filename: "implementor-1",
      filePath: "/test/sessions/task-1/implementor-1.json",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should get or create session from repository", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockGetOrCreateSession).toHaveBeenCalledWith("task-1", AgentType.IMPLEMENTOR);
    });

    it("should create agent instance with implementor system prompt and session file", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockInstanceCreate).toHaveBeenCalledWith({
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        systemPrompt: "implementor system prompt",
        sessionFilePath: "/test/sessions/task-1/implementor-1.json",
      });
    });

    it("should assign task in dyson-swarm", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
    });

    it("should send initial prompt after creating agent instance", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockSendMessage).toHaveBeenCalledWith(
        "instance-1",
        "test prompt",
        "/test/worktrees/task-1"
      );
    });

    it("should call onError if agent instance creation fails", async () => {
      mocks.mockInstanceCreate.mockRejectedValue(new Error("Agent instance creation failed"));
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
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
    it("should remove agent instance when stopped", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockInstanceRemove.mockResolvedValue(undefined);

      const agent = createImplementorAgent({
        taskId: "task-1",
        dysonTask: {
          id: "task-1",
          frontmatter: { title: "Test Task" },
          description: "Test description",
          status: "open",
        },
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();
      expect(agent.isRunning()).toBe(true);

      await agent.stop();

      expect(mocks.mockInstanceRemove).toHaveBeenCalledWith("task-1");
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await expect(agent.stop()).resolves.not.toThrow();
    });
  });

  describe("handleAgentInstanceIdle", () => {
    it("should remove agent instance and call onComplete", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockInstanceRemove.mockResolvedValue(undefined);
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: onCompleteMock,
        onError: vi.fn(),
      });

      await agent.start();

      await (agent as any).handleAgentInstanceIdle();

      expect(mocks.mockInstanceRemove).toHaveBeenCalledWith("task-1");
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      expect(agent.isRunning()).toBe(false);
    });

    it("should return true after start", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
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
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        taskManager: mockTaskManager,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(agent.isRunning()).toBe(true);
    });
  });
});
