import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPrompt = vi.fn();
const mockSubscribe = vi.fn();
const mockPiSession = {
  prompt: mockPrompt,
  subscribe: mockSubscribe,
};
const mockCreateAgentSession = vi.fn();
const mockReload = vi.fn();

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: (...args: unknown[]) => mockCreateAgentSession(...args),
  DefaultResourceLoader: class {
    reload = mockReload;
  },
  SessionManager: {
    inMemory: () => ({}),
  },
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { PiSessionAdapter } from "./pi.js";
import { existsSync, mkdirSync } from "node:fs";

describe("PiSessionAdapter", () => {
  let adapter: PiSessionAdapter;
  const testSessionsDir = "/test/sessions";

  beforeEach(() => {
    vi.clearAllMocks();
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    adapter = new PiSessionAdapter({ instancesDir: testSessionsDir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create sessions directory if it does not exist", () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      new PiSessionAdapter({ instancesDir: testSessionsDir });

      expect(existsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mkdirSync).toHaveBeenCalledWith(testSessionsDir, { recursive: true });
    });

    it("should not create sessions directory if it already exists", () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      new PiSessionAdapter({ instancesDir: testSessionsDir });

      expect(existsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("createAgentInstance", () => {
    it("should create a session successfully", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      const session = await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      expect(session.taskId).toBe("task-1");
      expect(session.status).toBe("running");
      expect(session.workingDirectory).toBe("/test/sessions/task-1");
      expect(session.instanceId).toMatch(/^pi-task-1-\d+$/);
    });

    it("should throw error if instance already exists", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      await expect(
        adapter.createAgentInstance({
          taskId: "task-1",
          workingDirectory: "/test/sessions/task-1",
          systemPrompt: "fake system prompt for test",
          model: { provider: "synthetic", modelId: "kimi-2.5" },
        })
      ).rejects.toThrow("Agent instance for task task-1 already exists");
    });

    it("should create working directory if it does not exist", async () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      expect(mkdirSync).toHaveBeenCalledWith("/test/sessions/task-1", { recursive: true });
    });

    it("should throw error if Pi SDK fails", async () => {
      mockCreateAgentSession.mockRejectedValue(new Error("SDK Error"));

      await expect(
        adapter.createAgentInstance({
          taskId: "task-1",
          workingDirectory: "/test/sessions/task-1",
          systemPrompt: "fake system prompt for test",
          model: { provider: "synthetic", modelId: "kimi-2.5" },
        })
      ).rejects.toThrow("Failed to create Pi agent instance for task task-1: SDK Error");
    });

    it("should subscribe to session events", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  describe("getAgentInstance", () => {
    it("should return instance if it exists", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      const createdInstance = await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      const retrievedInstance = await adapter.getAgentInstance("task-1");

      expect(retrievedInstance).toEqual(createdInstance);
    });

    it("should return undefined if instance does not exist", async () => {
      const instance = await adapter.getAgentInstance("nonexistent-task");

      expect(instance).toBeUndefined();
    });
  });

  describe("sendMessage", () => {
    let createdInstanceId: string;

    beforeEach(async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });
      const instance = await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });
      createdInstanceId = instance.instanceId;
    });

    it("should send message to instance", async () => {
      await adapter.sendMessage(createdInstanceId, "Hello Pi", "/test/sessions/task-1");

      expect(mockPrompt).toHaveBeenCalledWith("Hello Pi");
    });

    it("should throw error if instance not found", async () => {
      await expect(
        adapter.sendMessage("nonexistent-instance", "Hello", "/test/wd")
      ).rejects.toThrow("Agent instance nonexistent-instance not found");
    });

    it("should throw error if prompt fails", async () => {
      mockPrompt.mockRejectedValue(new Error("Prompt Error"));

      await expect(
        adapter.sendMessage(createdInstanceId, "Hello", "/test/sessions/task-1")
      ).rejects.toThrow("Failed to send message to Pi agent instance");
    });
  });

  describe("onAgentInstanceIdle", () => {
    it("should register callback", async () => {
      const callback = vi.fn();
      adapter.onAgentInstanceIdle(callback);

      // Get the event listener registered by subscribe
      let eventListener: ((event: { type: string }) => void) | undefined;
      mockSubscribe.mockImplementation((listener: (event: { type: string }) => void) => {
        eventListener = listener;
        return vi.fn();
      });

      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      // Simulate message_end event
      if (eventListener) {
        eventListener({ type: "message_end" });
      }

      expect(callback).toHaveBeenCalledWith("task-1", expect.objectContaining({
        taskId: "task-1",
        status: "running",
      }));
    });

    it("should trigger on turn_end event", async () => {
      const callback = vi.fn();
      adapter.onAgentInstanceIdle(callback);

      let eventListener: ((event: { type: string }) => void) | undefined;
      mockSubscribe.mockImplementation((listener: (event: { type: string }) => void) => {
        eventListener = listener;
        return vi.fn();
      });

      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      // Simulate turn_end event
      if (eventListener) {
        eventListener({ type: "turn_end" });
      }

      expect(callback).toHaveBeenCalled();
    });

    it("should call all registered callbacks", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      adapter.onAgentInstanceIdle(callback1);
      adapter.onAgentInstanceIdle(callback2);

      let eventListener: ((event: { type: string }) => void) | undefined;
      mockSubscribe.mockImplementation((listener: (event: { type: string }) => void) => {
        eventListener = listener;
        return vi.fn();
      });

      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      if (eventListener) {
        eventListener({ type: "message_end" });
      }

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("should continue calling callbacks even if one throws", async () => {
      const callback1 = vi.fn().mockImplementation(() => {
        throw new Error("Callback error");
      });
      const callback2 = vi.fn();
      adapter.onAgentInstanceIdle(callback1);
      adapter.onAgentInstanceIdle(callback2);

      let eventListener: ((event: { type: string }) => void) | undefined;
      mockSubscribe.mockImplementation((listener: (event: { type: string }) => void) => {
        eventListener = listener;
        return vi.fn();
      });

      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createAgentInstance({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
        systemPrompt: "fake system prompt for test",
        model: { provider: "synthetic", modelId: "kimi-2.5" },
      });

      if (eventListener) {
        eventListener({ type: "message_end" });
      }

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});
