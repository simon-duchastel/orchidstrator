import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdirSync, existsSync, readdirSync, type PathLike } from "node:fs";
import { join } from "node:path";
import { SessionRepository, createSessionRepository } from "./session-repository.js";
import { AgentType } from "./agent-type.js";

// Mock the fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const TEST_DIR = "/tmp/orchid-session-repo-test";

describe("SessionRepository", () => {
  let repository: SessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);
    vi.mocked(mkdirSync).mockImplementation(() => undefined);
  });

  describe("constructor", () => {
    it("should create sessions directory if it does not exist", () => {
      vi.mocked(existsSync).mockReturnValueOnce(false);
      
      createSessionRepository({ sessionsDir: TEST_DIR });
      
      expect(mkdirSync).toHaveBeenCalledWith(TEST_DIR, { recursive: true });
    });

    it("should not create sessions directory if it already exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      
      createSessionRepository({ sessionsDir: TEST_DIR });
      
      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("getOrCreateSession", () => {
    beforeEach(() => {
      repository = createSessionRepository({ sessionsDir: TEST_DIR });
    });

    it("should create a new session when none exists", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.taskId).toBe("task-1");
      expect(session.agentType).toBe(AgentType.IMPLEMENTOR);
      expect(session.version).toBe(1);
      expect(session.filename).toBe("implementor-1");
      expect(session.filePath).toBe(join(TEST_DIR, "task-1", "implementor-1.json"));
    });

    it("should create different sessions for different agent types", () => {
      vi.mocked(existsSync).mockImplementation((path: PathLike) => {
        // Return true for task directory after first call
        if (typeof path === 'string' && path.includes("task-1")) {
          return true;
        }
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);

      const implementorSession = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);
      const reviewerSession = repository.getOrCreateSession("task-1", AgentType.REVIEWER);
      const mergerSession = repository.getOrCreateSession("task-1", AgentType.MERGER);

      expect(implementorSession.agentType).toBe(AgentType.IMPLEMENTOR);
      expect(implementorSession.version).toBe(1);

      expect(reviewerSession.agentType).toBe(AgentType.REVIEWER);
      expect(reviewerSession.version).toBe(1);

      expect(mergerSession.agentType).toBe(AgentType.MERGER);
      expect(mergerSession.version).toBe(1);
    });

    it("should return existing session if one exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(["implementor-1.json"] as unknown as ReturnType<typeof readdirSync>);

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.taskId).toBe("task-1");
      expect(session.agentType).toBe(AgentType.IMPLEMENTOR);
      expect(session.version).toBe(1);
    });

    it("should return the latest version if multiple exist", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "implementor-1.json",
        "implementor-2.json",
        "implementor-3.json",
      ] as unknown as ReturnType<typeof readdirSync>);

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.version).toBe(3);
    });

    it("should handle different tasks independently", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const session1 = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);
      const session2 = repository.getOrCreateSession("task-2", AgentType.IMPLEMENTOR);

      expect(session1.taskId).toBe("task-1");
      expect(session2.taskId).toBe("task-2");
      expect(session1.filePath).not.toBe(session2.filePath);
    });

    it("should handle versions above 9 correctly", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "implementor-1.json",
        "implementor-10.json",
        "implementor-2.json",
      ] as unknown as ReturnType<typeof readdirSync>);

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.version).toBe(10);
    });
  });

  describe("getTaskSessionsDir", () => {
    beforeEach(() => {
      repository = createSessionRepository({ sessionsDir: TEST_DIR });
    });

    it("should return the correct path for task sessions", () => {
      const path = repository.getTaskSessionsDir("task-1");
      expect(path).toBe(join(TEST_DIR, "task-1"));
    });
  });

  describe("Session", () => {
    beforeEach(() => {
      repository = createSessionRepository({ sessionsDir: TEST_DIR });
    });

    it("should expose correct properties", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      
      const session = repository.getOrCreateSession("task-1", AgentType.REVIEWER);

      expect(session.taskId).toBe("task-1");
      expect(session.agentType).toBe(AgentType.REVIEWER);
      expect(session.version).toBe(1);
      expect(session.filename).toBe("reviewer-1");
      expect(session.filePath).toContain("reviewer-1.json");
    });
  });

  describe("findLatestSessionVersion edge cases", () => {
    beforeEach(() => {
      repository = createSessionRepository({ sessionsDir: TEST_DIR });
    });

    it("should ignore files that do not match the pattern", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "implementor-1.json",
        "other-file.txt",
        "implementor-2.json",
        "reviewer-1.json",
        "malformed-implementor.json",
      ] as unknown as ReturnType<typeof readdirSync>);

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.version).toBe(2);
      expect(session.agentType).toBe(AgentType.IMPLEMENTOR);
    });

    it("should handle empty task directory", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.version).toBe(1);
    });

    it("should not confuse similar agent types", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "implementor-5.json",
        "implementor-v2-1.json",
        "reviewer-10.json",
        "merger-3.json",
      ] as unknown as ReturnType<typeof readdirSync>);

      const implementorSession = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);
      const reviewerSession = repository.getOrCreateSession("task-1", AgentType.REVIEWER);
      const mergerSession = repository.getOrCreateSession("task-1", AgentType.MERGER);

      expect(implementorSession.version).toBe(5);
      expect(reviewerSession.version).toBe(10);
      expect(mergerSession.version).toBe(3);
    });

    it("should handle files with very high version numbers", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([
        "implementor-1.json",
        "implementor-999.json",
        "implementor-100.json",
      ] as unknown as ReturnType<typeof readdirSync>);

      const session = repository.getOrCreateSession("task-1", AgentType.IMPLEMENTOR);

      expect(session.version).toBe(999);
    });
  });

  describe("task directory creation", () => {
    beforeEach(() => {
      repository = createSessionRepository({ sessionsDir: TEST_DIR });
    });

    it("should create task directory when getting session for new task", () => {
      vi.mocked(existsSync).mockImplementation((path: PathLike) => {
        // sessionsDir exists, but task dir does not
        if (typeof path === 'string') {
          if (path === TEST_DIR) return true;
          if (path.includes("new-task")) return false;
        }
        return false;
      });

      repository.getOrCreateSession("new-task", AgentType.IMPLEMENTOR);

      expect(mkdirSync).toHaveBeenCalledWith(
        join(TEST_DIR, "new-task"),
        { recursive: true }
      );
    });
  });
});
