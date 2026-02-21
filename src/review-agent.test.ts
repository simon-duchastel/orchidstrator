import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReviewAgent } from "./review-agent";
import type { AgentSession } from "./opencode-session";

const mocks = vi.hoisted(() => {
  const mockGetAllSessions = vi.fn();

  return {
    mockGetAllSessions,
  };
});

describe("ReviewAgent", () => {
  let reviewAgent: ReviewAgent;
  let mockSessionManager: any;
  const mockSession: AgentSession = {
    sessionId: "test-session-123",
    taskId: "test-task-456",
    workingDirectory: "/test/worktrees/test-task-456",
    client: {} as any,
    createdAt: new Date(),
    status: "running",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockSessionManager = {
      getAllSessions: mocks.mockGetAllSessions,
    };

    reviewAgent = new ReviewAgent({
      sessionManager: mockSessionManager,
      pollIntervalMs: 100,
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("startMonitoring", () => {
    it("should start monitoring a session", async () => {
      // Mock session as running (never becomes idle so monitoring stays active)
      mocks.mockGetAllSessions.mockResolvedValue([{ ...mockSession, status: "running" }]);

      await reviewAgent.startMonitoring(mockSession);

      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(true);
      expect(reviewAgent.getMonitoredCount()).toBe(1);

      // Clean up
      reviewAgent.stopAllMonitoring();
    });

    it("should not start duplicate monitoring for the same session", async () => {
      // Mock session as running (never becomes idle)
      mocks.mockGetAllSessions.mockResolvedValue([{ ...mockSession, status: "running" }]);

      await reviewAgent.startMonitoring(mockSession);
      await reviewAgent.startMonitoring(mockSession);

      expect(reviewAgent.getMonitoredCount()).toBe(1);

      // Clean up
      reviewAgent.stopAllMonitoring();
    });

    it("should detect idle when session becomes stopped", async () => {
      // Session is running initially, then becomes stopped
      mocks.mockGetAllSessions
        .mockResolvedValueOnce([{ ...mockSession, status: "running" }])
        .mockResolvedValueOnce([{ ...mockSession, status: "stopped" }]);

      await reviewAgent.startMonitoring(mockSession);

      // Should be monitoring initially
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(true);

      // Advance timers to trigger polling - session is now stopped
      await vi.advanceTimersByTimeAsync(150);

      // After detecting idle, monitoring should stop
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(false);
    });

    it("should detect idle when session is not found", async () => {
      // Session exists initially, then disappears
      mocks.mockGetAllSessions
        .mockResolvedValueOnce([{ ...mockSession, status: "running" }])
        .mockResolvedValueOnce([]);

      await reviewAgent.startMonitoring(mockSession);

      // Should be monitoring initially
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(true);

      // Advance timers to trigger polling - session is now gone
      await vi.advanceTimersByTimeAsync(150);

      // After detecting idle (session not found), monitoring should stop
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(false);
    });
  });

  describe("stopMonitoring", () => {
    it("should stop monitoring a specific session", async () => {
      mocks.mockGetAllSessions.mockResolvedValue([mockSession]);

      await reviewAgent.startMonitoring(mockSession);
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(true);

      reviewAgent.stopMonitoring(mockSession.sessionId);
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(false);
    });

    it("should handle stopping a non-monitored session gracefully", () => {
      expect(() => {
        reviewAgent.stopMonitoring("non-existent-session");
      }).not.toThrow();
    });
  });

  describe("stopAllMonitoring", () => {
    it("should stop monitoring all sessions", async () => {
      mocks.mockGetAllSessions.mockResolvedValue([mockSession]);

      const session2 = { ...mockSession, sessionId: "session-2", taskId: "task-2" };

      await reviewAgent.startMonitoring(mockSession);
      await reviewAgent.startMonitoring(session2);

      expect(reviewAgent.getMonitoredCount()).toBe(2);

      reviewAgent.stopAllMonitoring();

      expect(reviewAgent.getMonitoredCount()).toBe(0);
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(false);
      expect(reviewAgent.isMonitoring(session2.sessionId)).toBe(false);
    });
  });

  describe("timeout handling", () => {
    it("should stop monitoring after timeout", async () => {
      // Session never becomes idle
      mocks.mockGetAllSessions.mockResolvedValue([
        { ...mockSession, status: "running" },
      ]);

      await reviewAgent.startMonitoring(mockSession);

      // Advance past timeout (5000ms)
      await vi.advanceTimersByTimeAsync(5100);

      // Monitoring should have stopped due to timeout
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle errors when checking session status", async () => {
      mocks.mockGetAllSessions.mockRejectedValue(new Error("Network error"));

      await reviewAgent.startMonitoring(mockSession);

      // Advance timers to trigger polling
      await vi.advanceTimersByTimeAsync(100);

      // Should still be monitoring despite error
      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(true);
    });
  });

  describe("getMonitoredCount", () => {
    it("should return 0 when no sessions are monitored", () => {
      expect(reviewAgent.getMonitoredCount()).toBe(0);
    });

    it("should increment count when starting to monitor", async () => {
      // Mock session as running so monitoring stays active
      // Use a custom mock that always returns running for this test
      const runningSessionManager = {
        getAllSessions: vi.fn().mockResolvedValue([
          { ...mockSession, status: "running" },
        ]),
      };

      const testReviewAgent = new ReviewAgent({
        sessionManager: runningSessionManager as any,
        pollIntervalMs: 100,
        timeoutMs: 5000,
      });

      // Initially 0
      expect(testReviewAgent.getMonitoredCount()).toBe(0);

      // Start monitoring
      await testReviewAgent.startMonitoring(mockSession);
      
      // Should be monitoring
      expect(testReviewAgent.getMonitoredCount()).toBe(1);
      expect(testReviewAgent.isMonitoring(mockSession.sessionId)).toBe(true);

      // Clean up
      testReviewAgent.stopAllMonitoring();
    });

    it("should decrement count when stopping monitoring", async () => {
      const runningSessionManager = {
        getAllSessions: vi.fn().mockResolvedValue([
          { ...mockSession, status: "running" },
        ]),
      };

      const testReviewAgent = new ReviewAgent({
        sessionManager: runningSessionManager as any,
        pollIntervalMs: 100,
        timeoutMs: 5000,
      });

      await testReviewAgent.startMonitoring(mockSession);
      expect(testReviewAgent.getMonitoredCount()).toBe(1);

      // Stop monitoring
      testReviewAgent.stopMonitoring(mockSession.sessionId);
      expect(testReviewAgent.getMonitoredCount()).toBe(0);
      expect(testReviewAgent.isMonitoring(mockSession.sessionId)).toBe(false);
    });
  });

  describe("isMonitoring", () => {
    it("should return false for non-monitored session", () => {
      expect(reviewAgent.isMonitoring("unknown-session")).toBe(false);
    });

    it("should return true for monitored session", async () => {
      mocks.mockGetAllSessions.mockResolvedValue([mockSession]);

      await reviewAgent.startMonitoring(mockSession);

      expect(reviewAgent.isMonitoring(mockSession.sessionId)).toBe(true);
    });
  });

  describe("poll interval configuration", () => {
    it("should use default poll interval when not specified", () => {
      const agent = new ReviewAgent({
        sessionManager: mockSessionManager,
      });

      // Default should be 5000ms
      expect(agent).toBeDefined();
    });

    it("should use custom poll interval when specified", async () => {
      mocks.mockGetAllSessions.mockResolvedValue([mockSession]);

      const customAgent = new ReviewAgent({
        sessionManager: mockSessionManager,
        pollIntervalMs: 250,
      });

      await customAgent.startMonitoring(mockSession);

      // Should be monitoring
      expect(customAgent.isMonitoring(mockSession.sessionId)).toBe(true);
    });
  });

  describe("multiple concurrent sessions", () => {
    it("should prevent duplicate monitoring of same session", async () => {
      // Mock session as running so monitoring stays active
      mocks.mockGetAllSessions.mockResolvedValue([
        { ...mockSession, status: "running" },
      ]);

      // Start monitoring same session twice
      await reviewAgent.startMonitoring(mockSession);
      expect(reviewAgent.getMonitoredCount()).toBe(1);

      await reviewAgent.startMonitoring(mockSession);
      // Should still be 1, not 2
      expect(reviewAgent.getMonitoredCount()).toBe(1);

      // Clean up
      reviewAgent.stopAllMonitoring();
    });

    it("should track different sessions separately", async () => {
      const sessionManager = {
        getAllSessions: vi.fn().mockImplementation(() => {
          return Promise.resolve([
            { ...mockSession, sessionId: "sep-1", status: "running" },
            { ...mockSession, sessionId: "sep-2", status: "running" },
          ]);
        }),
      };

      const testAgent = new ReviewAgent({
        sessionManager: sessionManager as any,
        pollIntervalMs: 100,
        timeoutMs: 5000,
      });

      const session1 = { ...mockSession, sessionId: "sep-1", taskId: "task-1" };
      const session2 = { ...mockSession, sessionId: "sep-2", taskId: "task-2" };

      await testAgent.startMonitoring(session1);
      expect(testAgent.isMonitoring("sep-1")).toBe(true);
      expect(testAgent.isMonitoring("sep-2")).toBe(false);

      await testAgent.startMonitoring(session2);
      expect(testAgent.isMonitoring("sep-1")).toBe(true);
      expect(testAgent.isMonitoring("sep-2")).toBe(true);

      // Clean up
      testAgent.stopAllMonitoring();
    });
  });
});
