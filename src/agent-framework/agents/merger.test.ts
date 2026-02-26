import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMergerAgent } from "./merger.js";
import { AgentType } from "../session-repository.js";

const mocks = vi.hoisted(() => {
  const mockInstanceCreate = vi.fn();
  const mockInstanceRemove = vi.fn();
  const mockSendMessage = vi.fn();
  const mockGetOrCreateSession = vi.fn();

  class MockAgentInstanceManager {
    createAgentInstance = mockInstanceCreate;
    removeAgentInstance = mockInstanceRemove;
    sendMessage = mockSendMessage;
  }

  class MockSessionRepository {
    getOrCreateSession = mockGetOrCreateSession;
  }

  return {
    mockInstanceCreate,
    mockInstanceRemove,
    mockSendMessage,
    mockGetOrCreateSession,
    MockAgentInstanceManager,
    MockSessionRepository,
  };
});

vi.mock("../../templates/index.js", () => ({
  fillMergerPromptTemplate: vi.fn(() => "test merge prompt"),
  getMergerSystemPrompt: vi.fn(() => "merger system prompt"),
}));

describe("MergerAgent", () => {
  let mockAgentInstanceManager: any;
  let mockSessionRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentInstanceManager = new mocks.MockAgentInstanceManager();
    mockSessionRepository = new mocks.MockSessionRepository();
    
    // Default mock for getOrCreateSession
    mocks.mockGetOrCreateSession.mockReturnValue({
      taskId: "task-1",
      agentType: AgentType.MERGER,
      version: 1,
      filename: "merger-1",
      filePath: "/test/sessions/task-1/merger-1.json",
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
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockGetOrCreateSession).toHaveBeenCalledWith("task-1", AgentType.MERGER);
    });

    it("should create agent instance with merger system prompt and session file", async () => {
      const mockInstance = {
        instanceId: "instance-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockInstanceCreate.mockResolvedValue(mockInstance);
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockInstanceCreate).toHaveBeenCalledWith({
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        systemPrompt: "merger system prompt",
        sessionFilePath: "/test/sessions/task-1/merger-1.json",
      });
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
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(mocks.mockSendMessage).toHaveBeenCalledWith(
        "instance-1",
        "test merge prompt",
        "/test/worktrees/task-1"
      );
    });

    it("should call onError if agent instance creation fails", async () => {
      mocks.mockInstanceCreate.mockRejectedValue(new Error("Agent instance creation failed"));
      const onErrorMock = vi.fn();

      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
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
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockInstanceRemove.mockResolvedValue(undefined);

      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
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
      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
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
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockInstanceRemove.mockResolvedValue(undefined);
      const onCompleteMock = vi.fn();

      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
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
      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
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
      mocks.mockSendMessage.mockResolvedValue(undefined);

      const agent = createMergerAgent({
        taskId: "task-1",
        worktreePath: "/test/worktrees/task-1",
        agentInstanceManager: mockAgentInstanceManager,
        sessionRepository: mockSessionRepository,
        onComplete: vi.fn(),
        onError: vi.fn(),
      });

      await agent.start();

      expect(agent.isRunning()).toBe(true);
    });
  });
});
