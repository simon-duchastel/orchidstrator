import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpencodeSessionManager } from "./opencode-session";

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
    sessionManager = new OpencodeSessionManager({ sessionsDir: testSessionsDir });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create sessions directory if it does not exist", () => {
      mocks.mockExistsSync.mockReturnValue(false);
      
      new OpencodeSessionManager({ sessionsDir: testSessionsDir });

      expect(mocks.mockExistsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mocks.mockMkdirSync).toHaveBeenCalledWith(testSessionsDir, { recursive: true });
    });

    it("should not create sessions directory if it already exists", () => {
      mocks.mockExistsSync.mockReturnValue(true);
      
      new OpencodeSessionManager({ sessionsDir: testSessionsDir });

      expect(mocks.mockExistsSync).toHaveBeenCalledWith(testSessionsDir);
      expect(mocks.mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("createSession", () => {
    it("should create a session successfully", async () => {
      const mockResponse = {
        data: { id: "session-123" },
        error: null,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockResponse);

      const session = await sessionManager.createSession("task-1", {
        title: "Test Session",
      });

      expect(session.sessionId).toBe("session-123");
      expect(session.taskId).toBe("task-1");
      expect(session.status).toBe("running");
      expect(session.workingDirectory).toBe("/test/sessions/task-1");
      expect(mocks.mockSessionCreate).toHaveBeenCalledWith({
        query: { directory: "/test/sessions/task-1" },
        body: { title: "Test Session" },
      });
    });

    it("should use default title if not provided", async () => {
      const mockResponse = {
        data: { id: "session-456" },
        error: null,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockResponse);

      await sessionManager.createSession("task-2", {
        
      });

      expect(mocks.mockSessionCreate).toHaveBeenCalledWith({
        query: { directory: "/test/sessions/task-2" },
        body: { title: "Agent Session for task-2" },
      });
    });

    it("should throw error if session already exists", async () => {
      const mockResponse = {
        data: { id: "session-789" },
        error: null,
      };
      mocks.mockSessionCreate.mockResolvedValue(mockResponse);

      await sessionManager.createSession("task-3", {
        
      });

      await expect(
        sessionManager.createSession("task-3", {  })
      ).rejects.toThrow("Session for task task-3 already exists");
    });

    it("should throw error if session creation fails", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: null,
        error: { message: "Server error" },
      });

      await expect(
        sessionManager.createSession("task-4", {  })
      ).rejects.toThrow("Failed to create session");
    });

    it("should throw error if response data is null", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        sessionManager.createSession("task-5", {  })
      ).rejects.toThrow("Failed to get session ID from create response");
    });

    it("should extract session ID from nested data field", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: { data: { id: "nested-session-123" } },
        error: null,
      });

      const session = await sessionManager.createSession("task-6", {
        
      });

      expect(session.sessionId).toBe("nested-session-123");
    });

    it("should extract session ID from sessionId field", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: { sessionId: "alt-session-123" },
        error: null,
      });

      const session = await sessionManager.createSession("task-7", {
        
      });

      expect(session.sessionId).toBe("alt-session-123");
    });

    it("should create working directory if it does not exist", async () => {
      mocks.mockExistsSync.mockImplementation((path: string) => {
        if (path === testSessionsDir) return true;
        return false;
      });

      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-999" },
        error: null,
      });

      await sessionManager.createSession("task-8", {
        
      });

      expect(mocks.mockMkdirSync).toHaveBeenCalledWith(
        "/test/sessions/task-8",
        { recursive: true }
      );
    });
  });

  describe("getSession", () => {
    it("should return session if it exists", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-abc" },
        error: null,
      });

      await sessionManager.createSession("task-get", {
        
      });

      const session = sessionManager.getSession("task-get");

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("session-abc");
    });

    it("should return undefined if session does not exist", () => {
      const session = sessionManager.getSession("non-existent");
      expect(session).toBeUndefined();
    });
  });

  describe("getAllSessions", () => {
    it("should return all sessions", async () => {
      mocks.mockSessionCreate
        .mockResolvedValueOnce({ data: { id: "session-1" }, error: null })
        .mockResolvedValueOnce({ data: { id: "session-2" }, error: null });

      await sessionManager.createSession("task-a", {  });
      await sessionManager.createSession("task-b", {  });

      const sessions = sessionManager.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId)).toContain("session-1");
      expect(sessions.map((s) => s.sessionId)).toContain("session-2");
    });

    it("should return empty array when no sessions", () => {
      const sessions = sessionManager.getAllSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe("hasSession", () => {
    it("should return true if session exists", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-exists" },
        error: null,
      });

      await sessionManager.createSession("task-check", {
        
      });

      expect(sessionManager.hasSession("task-check")).toBe(true);
    });

    it("should return false if session does not exist", () => {
      expect(sessionManager.hasSession("task-missing")).toBe(false);
    });
  });

  describe("removeSession", () => {
    it("should remove session successfully", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-remove" },
        error: null,
      });
      mocks.mockSessionDelete.mockResolvedValue({ data: {}, error: null });

      await sessionManager.createSession("task-remove", {
        
      });

      await sessionManager.removeSession("task-remove");

      expect(mocks.mockSessionDelete).toHaveBeenCalledWith({
        path: { id: "session-remove" },
        query: { directory: "/test/sessions/task-remove" },
      });
      expect(sessionManager.hasSession("task-remove")).toBe(false);
    });

    it("should throw error if session does not exist", async () => {
      await expect(sessionManager.removeSession("non-existent")).rejects.toThrow(
        "Session for task non-existent not found"
      );
    });

    it("should remove from tracking even if delete fails", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-fail" },
        error: null,
      });
      mocks.mockSessionDelete.mockRejectedValue(new Error("Delete failed"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await sessionManager.createSession("task-fail", {
        
      });

      await sessionManager.removeSession("task-fail");

      expect(sessionManager.hasSession("task-fail")).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting session"),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  describe("stopAllSessions", () => {
    it("should stop all sessions", async () => {
      mocks.mockSessionCreate
        .mockResolvedValueOnce({ data: { id: "session-x" }, error: null })
        .mockResolvedValueOnce({ data: { id: "session-y" }, error: null });
      mocks.mockSessionDelete.mockResolvedValue({ data: {}, error: null });

      await sessionManager.createSession("task-x", {  });
      await sessionManager.createSession("task-y", {  });

      expect(sessionManager.getSessionCount()).toBe(2);

      await sessionManager.stopAllSessions();

      expect(sessionManager.getSessionCount()).toBe(0);
    });

    it("should handle errors gracefully when stopping sessions", async () => {
      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-z" },
        error: null,
      });
      mocks.mockSessionDelete.mockRejectedValue(new Error("Delete error"));

      await sessionManager.createSession("task-z", {  });

      // Should not throw
      await expect(sessionManager.stopAllSessions()).resolves.toBeUndefined();
      expect(sessionManager.getSessionCount()).toBe(0);
    });
  });

  describe("getSessionCount", () => {
    it("should return correct count", async () => {
      expect(sessionManager.getSessionCount()).toBe(0);

      mocks.mockSessionCreate.mockResolvedValue({
        data: { id: "session-count" },
        error: null,
      });

      await sessionManager.createSession("task-count", {
        
      });

      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });
});
