import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMergerAgent } from "./merger.js";
import { AgentType } from "../agent-type.js";

const mocks = vi.hoisted(() => {
  const mockAgentInstanceCreate = vi.fn();
  const mockAgentInstanceRemove = vi.fn();
  const mockSendMessage = vi.fn();
  const mockGetOrCreateSession = vi.fn();

  class MockAgentInstanceManager {
    createAgentInstance = mockAgentInstanceCreate;
    removeAgentInstance = mockAgentInstanceRemove;
    sendMessage = mockSendMessage;
  }

  class MockSessionRepository {
    getOrCreateSession = mockGetOrCreateSession;
  }

  return {
    mockAgentInstanceCreate,
    mockAgentInstanceRemove,
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
    mocks.mockGetOrCreateSession.mockReturnValue({
      filename: "merger-1",
      filePath: "/test/.orchid/sessions/task-1/merger-1.json",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should create session with merger system prompt", async () => {
      const mockAgentInstance = {
        instanceId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockAgentInstanceCreate.mockResolvedValue(mockAgentInstance);
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
      expect(mocks.mockAgentInstanceCreate).toHaveBeenCalledWith({
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        systemPrompt: "merger system prompt",
        sessionFilePath: "/test/.orchid/sessions/task-1/merger-1.json",
      });
    });

    it("should send initial prompt after creating session", async () => {
      const mockAgentInstance = {
        instanceId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockAgentInstanceCreate.mockResolvedValue(mockAgentInstance);
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
        "session-1",
        "test merge prompt",
        "/test/worktrees/task-1"
      );
    });

    it("should call onError if session creation fails", async () => {
      mocks.mockAgentInstanceCreate.mockRejectedValue(new Error("Session creation failed"));
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
    it("should remove session when stopped", async () => {
      const mockAgentInstance = {
        instanceId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockAgentInstanceCreate.mockResolvedValue(mockAgentInstance);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockAgentInstanceRemove.mockResolvedValue(undefined);

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

      expect(mocks.mockAgentInstanceRemove).toHaveBeenCalledWith("task-1");
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
    it("should remove session and call onComplete", async () => {
      const mockAgentInstance = {
        instanceId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockAgentInstanceCreate.mockResolvedValue(mockAgentInstance);
      mocks.mockSendMessage.mockResolvedValue(undefined);
      mocks.mockAgentInstanceRemove.mockResolvedValue(undefined);
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

      expect(mocks.mockAgentInstanceRemove).toHaveBeenCalledWith("task-1");
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
      const mockAgentInstance = {
        instanceId: "session-1",
        taskId: "task-1",
        workingDirectory: "/test/worktrees/task-1",
        createdAt: new Date(),
        status: "running" as const,
      };
      mocks.mockAgentInstanceCreate.mockResolvedValue(mockAgentInstance);
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
