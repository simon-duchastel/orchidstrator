import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpencodeSessionManager } from "./manager.js";

const mocks = vi.hoisted(() => {
  const mockSessionCreate = vi.fn();
  const mockSessionDelete = vi.fn();
  const mockSessionList = vi.fn();
  const mockMkdirSync = vi.fn();
  const mockExistsSync = vi.fn();

  const mockClient = {
    session: {
      create: mockSessionCreate,
      delete: mockSessionDelete,
      list: mockSessionList,
    },
  };

  return {
    mockSessionCreate,
    mockSessionDelete,
    mockSessionList,
    mockMkdirSync,
    mockExistsSync,
    mockClient,
  };
});

vi.mock("@opencode-ai/sdk", () => ({
  createOpencodeClient: vi.fn(() => mocks.mockClient),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.mockExistsSync,
  mkdirSync: mocks.mockMkdirSync,
}));

describe("OpencodeSessionManager", () => {
  let sessionManager: OpencodeSessionManager;
  const testSessionsDir = "/test/sessions";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockExistsSync.mockReturnValue(true);
    sessionManager = new OpencodeSessionManager({ sessionsDir: testSessionsDir, baseUrl: "http://localhost:4096" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create sessions directory if it does not exist", () => {
      mocks.mockExistsSync.mockReturnValue(false);
      
      new OpencodeSessionManager({ sessionsDir: testSessionsDir, baseUrl: "http://localhost:4096" });

      expect(mocks.mockExistsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mocks.mockMkdirSync).toHaveBeenCalledWith(testSessionsDir, { recursive: true });
    });

    it("should not create sessions directory if it already exists", () => {
      mocks.mockExistsSync.mockReturnValue(true);
      
      new OpencodeSessionManager({ sessionsDir: testSessionsDir, baseUrl: "http://localhost:4096" });

      expect(mocks.mockExistsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mocks.mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("createSession", () => {
    it("should create a session successfully", async () => {
      // Mock empty list to indicate session doesn't exist yet
      mocks.mockSessionList.mockResolvedValue({ data: [], error: null });
      
      const mockResponse = {
        data: { id: "session-123" },
        error: null,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockResponse);

      const session = await sessionManager.createSession("task-1");

      expect(session.sessionId).toBe("session-123");
      expect(session.taskId).toBe("task-1");
      expect(session.status).toBe("running");
      expect(session.workingDirectory).toBe("/test/sessions/task-1");
      expect(mocks.mockSessionCreate).toHaveBeenCalledWith({
        query: { directory: "/test/sessions/task-1" },
        body: { title: "task-1" },
      });
    });

    it("should use taskId as title", async () => {
      mocks.mockSessionList.mockResolvedValue({ data: [], error: null });
      
      const mockResponse = {
        data: { id: "session-456" },
        error: null,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockResponse);

      await sessionManager.createSession("task-2");

      expect(mocks.mockSessionCreate).toHaveBeenCalledWith({
        query: { directory: "/test/sessions/task-2" },
        body: { title: "task-2" },
      });
    });

    it("should throw error if session already exists", async () => {
      // Mock existing session with matching title
      mocks.mockSessionList.mockResolvedValue({
        data: [{ id: "existing-session", title: "task-3", time: { created: Date.now() / 1000 } }],
        error: null,
      });

      await expect(
        sessionManager.createSession("task-3")
      ).rejects.toThrow("Session for task task-3 already exists");
    });

    it("should throw error if session creation fails", async () => {
      mocks.mockSessionList.mockResolvedValue({ data: [], error: null });
      mocks.mockSessionCreate.mockResolvedValue({
        data: null,
        error: { message: "Server error" },
      });

      await expect(
        sessionManager.createSession("task-4")
      ).rejects.toThrow("Failed to create session");
    });

    it("should throw error if response data is null", async () => {
      mocks.mockSessionList.mockResolvedValue({ data: [], error: null });
      mocks.mockSessionCreate.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        sessionManager.createSession("task-5")
      ).rejects.toThrow("Failed to get session ID from create response");
    });

    it("should extract session ID from nested data field", async () => {
      mocks.mockSessionList.mockResolvedValue({ data: [], error: null });
      mocks.mockSessionCreate.mockResolvedValue({
        data: { data: { id: "nested-session-123" } },
        error: null,
      });

      const session = await sessionManager.createSession("task-6");

      expect(session.sessionId).toBe("nested-session-123");
    });

    it("should extract session ID from sessionId field", async () => {
      mocks.mockSessionList.mockResolvedValue({ data: [], error: null });
      mocks.mockSessionCreate.mockResolvedValue({
        data: { sessionId: "alt-session-123" },
        error: null,
      });

      const session = await sessionManager.createSession("task-7");

      expect(session.sessionId).toBe("alt-session-123");
    });

    it("should create working directory if it does not exist", async () => {
      mocks.mockExistsSync.mockImplementation((path: string) => {
        if (path === testSessionsDir) return true;
        return false;
      });

      mocks.mockSessionList.mockResolvedValue({ data: [], error: null });
      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-999" },
        error: null,
      });

      await sessionManager.createSession("task-8");

      expect(mocks.mockMkdirSync).toHaveBeenCalledWith(
        "/test/sessions/task-8",
        { recursive: true }
      );
    });
  });

  describe("getSession", () => {
    it("should return session if it exists in server", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [{ id: "session-abc", title: "task-get", time: { created: 1704067200 } }],
        error: null,
      });

      const session = await sessionManager.getSession("task-get");

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("session-abc");
      expect(session?.taskId).toBe("task-get");
    });

    it("should return undefined if session does not exist in server", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [],
        error: null,
      });

      const session = await sessionManager.getSession("non-existent");
      expect(session).toBeUndefined();
    });

    it("should return undefined if list query fails", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: null,
        error: { message: "Query failed" },
      });

      const session = await sessionManager.getSession("task-error");
      expect(session).toBeUndefined();
    });
  });

  describe("getAllSessions", () => {
    it("should return all sessions from server", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [
          { id: "session-1", title: "task-a", time: { created: 1704067200 } },
          { id: "session-2", title: "task-b", time: { created: 1704153600 } },
        ],
        error: null,
      });

      const sessions = await sessionManager.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId)).toContain("session-1");
      expect(sessions.map((s) => s.sessionId)).toContain("session-2");
    });

    it("should return empty array when no sessions in server", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [],
        error: null,
      });

      const sessions = await sessionManager.getAllSessions();
      expect(sessions).toEqual([]);
    });

    it("should return empty array when query fails", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: null,
        error: { message: "Query failed" },
      });

      const sessions = await sessionManager.getAllSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe("hasSession", () => {
    it("should return true if session exists in server", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [{ id: "session-exists", title: "task-check", time: { created: 1704067200 } }],
        error: null,
      });

      const hasSession = await sessionManager.hasSession("task-check");
      expect(hasSession).toBe(true);
    });

    it("should return false if session does not exist in server", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [],
        error: null,
      });

      const hasSession = await sessionManager.hasSession("task-missing");
      expect(hasSession).toBe(false);
    });
  });

  describe("removeSession", () => {
    it("should remove session successfully", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [{ id: "session-remove", title: "task-remove", time: { created: 1704067200 } }],
        error: null,
      });
      mocks.mockSessionDelete.mockResolvedValue({ data: {}, error: null });

      await sessionManager.removeSession("task-remove");

      expect(mocks.mockSessionDelete).toHaveBeenCalledWith({
        path: { id: "session-remove" },
        query: { directory: "/test/sessions/task-remove" },
      });
    });

    it("should throw error if session does not exist", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(sessionManager.removeSession("non-existent")).rejects.toThrow(
        "Session for task non-existent not found"
      );
    });

    it("should throw error if delete fails", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [{ id: "session-fail", title: "task-fail", time: { created: 1704067200 } }],
        error: null,
      });
      mocks.mockSessionDelete.mockRejectedValue(new Error("Delete failed"));

      await expect(sessionManager.removeSession("task-fail")).rejects.toThrow(
        "Failed to delete session"
      );
    });
  });

  describe("stopAllSessions", () => {
    it("should stop all sessions from server", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [
          { id: "session-x", title: "task-x", time: { created: 1704067200 } },
          { id: "session-y", title: "task-y", time: { created: 1704153600 } },
        ],
        error: null,
      });
      mocks.mockSessionDelete.mockResolvedValue({ data: {}, error: null });

      await sessionManager.stopAllSessions();

      expect(mocks.mockSessionDelete).toHaveBeenCalledTimes(2);
    });

    it("should handle errors gracefully when stopping sessions", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      mocks.mockSessionList.mockResolvedValue({
        data: [
          { id: "session-z", title: "task-z", time: { created: 1704067200 } },
        ],
        error: null,
      });
      mocks.mockSessionDelete.mockRejectedValue(new Error("Delete error"));

      // Should not throw
      await expect(sessionManager.stopAllSessions()).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });

    it("should do nothing when no sessions exist", async () => {
      mocks.mockSessionList.mockResolvedValue({
        data: [],
        error: null,
      });

      await sessionManager.stopAllSessions();

      expect(mocks.mockSessionDelete).not.toHaveBeenCalled();
    });
  });
});
