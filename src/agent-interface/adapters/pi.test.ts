import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Pi SDK
const mockPrompt = vi.fn();
const mockSubscribe = vi.fn();
const mockPiSession = {
  prompt: mockPrompt,
  subscribe: mockSubscribe,
};
const mockCreateAgentSession = vi.fn();

vi.mock("@mariozechner/pi-coding-agent", () => ({
  createAgentSession: (...args: unknown[]) => mockCreateAgentSession(...args),
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
    adapter = new PiSessionAdapter({ sessionsDir: testSessionsDir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create sessions directory if it does not exist", () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

      new PiSessionAdapter({ sessionsDir: testSessionsDir });

      expect(existsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mkdirSync).toHaveBeenCalledWith(testSessionsDir, { recursive: true });
    });

    it("should not create sessions directory if it already exists", () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

      new PiSessionAdapter({ sessionsDir: testSessionsDir });

      expect(existsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("createSession", () => {
    it("should create a session successfully", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      const session = await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
      });

      expect(session.taskId).toBe("task-1");
      expect(session.status).toBe("running");
      expect(session.workingDirectory).toBe("/test/sessions/task-1");
      expect(session.sessionId).toMatch(/^pi-task-1-\d+$/);
    });

    it("should throw error if session already exists", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
      });

      await expect(
        adapter.createSession({
          taskId: "task-1",
          workingDirectory: "/test/sessions/task-1",
        })
      ).rejects.toThrow("Session for task task-1 already exists");
    });

    it("should create working directory if it does not exist", async () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
      });

      expect(mkdirSync).toHaveBeenCalledWith("/test/sessions/task-1", { recursive: true });
    });

    it("should throw error if Pi SDK fails", async () => {
      mockCreateAgentSession.mockRejectedValue(new Error("SDK Error"));

      await expect(
        adapter.createSession({
          taskId: "task-1",
          workingDirectory: "/test/sessions/task-1",
        })
      ).rejects.toThrow("Failed to create Pi session for task task-1: SDK Error");
    });

    it("should subscribe to session events", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
      });

      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  describe("getSession", () => {
    it("should return session if it exists", async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      const createdSession = await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
      });

      const retrievedSession = await adapter.getSession("task-1");

      expect(retrievedSession).toEqual(createdSession);
    });

    it("should return undefined if session does not exist", async () => {
      const session = await adapter.getSession("nonexistent-task");

      expect(session).toBeUndefined();
    });
  });

  describe("sendMessage", () => {
    let createdSessionId: string;

    beforeEach(async () => {
      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });
      const session = await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
      });
      createdSessionId = session.sessionId;
    });

    it("should send message to session", async () => {
      await adapter.sendMessage(createdSessionId, "Hello Pi", "/test/sessions/task-1");

      expect(mockPrompt).toHaveBeenCalledWith("Hello Pi");
    });

    it("should throw error if session not found", async () => {
      await expect(
        adapter.sendMessage("nonexistent-session", "Hello", "/test/wd")
      ).rejects.toThrow("Session nonexistent-session not found");
    });

    it("should throw error if prompt fails", async () => {
      mockPrompt.mockRejectedValue(new Error("Prompt Error"));

      await expect(
        adapter.sendMessage(createdSessionId, "Hello", "/test/sessions/task-1")
      ).rejects.toThrow("Failed to send message to Pi session");
    });
  });

  describe("onSessionIdle", () => {
    it("should register callback", async () => {
      const callback = vi.fn();
      adapter.onSessionIdle(callback);

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

      await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
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
      adapter.onSessionIdle(callback);

      let eventListener: ((event: { type: string }) => void) | undefined;
      mockSubscribe.mockImplementation((listener: (event: { type: string }) => void) => {
        eventListener = listener;
        return vi.fn();
      });

      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
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
      adapter.onSessionIdle(callback1);
      adapter.onSessionIdle(callback2);

      let eventListener: ((event: { type: string }) => void) | undefined;
      mockSubscribe.mockImplementation((listener: (event: { type: string }) => void) => {
        eventListener = listener;
        return vi.fn();
      });

      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
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
      adapter.onSessionIdle(callback1);
      adapter.onSessionIdle(callback2);

      let eventListener: ((event: { type: string }) => void) | undefined;
      mockSubscribe.mockImplementation((listener: (event: { type: string }) => void) => {
        eventListener = listener;
        return vi.fn();
      });

      mockCreateAgentSession.mockResolvedValue({
        session: mockPiSession,
        extensionsResult: { extensions: [] },
      });

      await adapter.createSession({
        taskId: "task-1",
        workingDirectory: "/test/sessions/task-1",
      });

      if (eventListener) {
        eventListener({ type: "message_end" });
      }

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});
