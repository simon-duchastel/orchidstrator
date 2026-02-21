/**
 * Review Agent
 *
 * Waits for implementor agents to become idle and then invokes a review agent
 * to review their work. The review agent is triggered when an agent's session
 * reaches an idle state, indicating it has completed its work.
 */

import { OpencodeSessionManager, type AgentSession } from "./opencode-session.js";
import { log } from "./utils/logger.js";

export interface ReviewAgentOptions {
  sessionManager: OpencodeSessionManager;
  /** Polling interval in milliseconds (default: 5000ms) */
  pollIntervalMs?: number;
  /** Maximum time to wait for idle in milliseconds (default: 300000ms / 5 minutes) */
  timeoutMs?: number;
}

export interface IdleDetectionResult {
  sessionId: string;
  taskId: string;
  idleDetected: boolean;
  reason?: string;
}

/**
 * Manages review agents that are triggered when implementor agents become idle.
 */
export class ReviewAgent {
  private sessionManager: OpencodeSessionManager;
  private pollIntervalMs: number;
  private timeoutMs: number;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(options: ReviewAgentOptions) {
    this.sessionManager = options.sessionManager;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.timeoutMs = options.timeoutMs ?? 300000;
  }

  /**
   * Start monitoring an agent session for idle state and invoke review agent when idle.
   * This method returns immediately and runs the monitoring in the background.
   *
   * @param session - The agent session to monitor
   * @returns A promise that resolves when monitoring starts (not when idle is detected)
   */
  async startMonitoring(session: AgentSession): Promise<void> {
    const { sessionId, taskId } = session;

    if (this.abortControllers.has(sessionId)) {
      log.log(`[review-agent] Already monitoring session ${sessionId} for task ${taskId}`);
      return;
    }

    log.log(`[review-agent] Starting to monitor session ${sessionId} for task ${taskId}`);

    const abortController = new AbortController();
    this.abortControllers.set(sessionId, abortController);

    // Run monitoring in the background
    this.monitorForIdle(session, abortController.signal).catch((error) => {
      log.error(`[review-agent] Error monitoring session ${sessionId}:`, error);
    });
  }

  /**
   * Stop monitoring a specific session.
   *
   * @param sessionId - The session ID to stop monitoring
   */
  stopMonitoring(sessionId: string): void {
    const abortController = this.abortControllers.get(sessionId);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(sessionId);
      log.log(`[review-agent] Stopped monitoring session ${sessionId}`);
    }
  }

  /**
   * Stop monitoring all sessions.
   */
  stopAllMonitoring(): void {
    for (const [sessionId, abortController] of this.abortControllers) {
      abortController.abort();
      log.log(`[review-agent] Stopped monitoring session ${sessionId}`);
    }
    this.abortControllers.clear();
  }

  /**
   * Check if a session is currently being monitored.
   *
   * @param sessionId - The session ID to check
   * @returns true if the session is being monitored
   */
  isMonitoring(sessionId: string): boolean {
    return this.abortControllers.has(sessionId);
  }

  /**
   * Get the number of sessions currently being monitored.
   *
   * @returns The number of monitored sessions
   */
  getMonitoredCount(): number {
    return this.abortControllers.size;
  }

  /**
   * Internal method to monitor a session until it becomes idle.
   *
   * @param session - The agent session to monitor
   * @param signal - Abort signal for cancellation
   * @returns Promise that resolves when idle is detected or monitoring is stopped
   */
  private async monitorForIdle(
    session: AgentSession,
    signal: AbortSignal
  ): Promise<IdleDetectionResult> {
    const { sessionId, taskId } = session;
    const startTime = Date.now();

    try {
      while (!signal.aborted) {
        // Check if we've exceeded the timeout
        if (Date.now() - startTime > this.timeoutMs) {
          log.log(`[review-agent] Timeout waiting for idle on session ${sessionId}`);
          this.abortControllers.delete(sessionId);
          return {
            sessionId,
            taskId,
            idleDetected: false,
            reason: "timeout",
          };
        }

        // Check session status
        const isIdle = await this.checkSessionIdle(sessionId);

        if (isIdle) {
          log.log(`[review-agent] Session ${sessionId} is now idle, invoking review agent`);
          this.abortControllers.delete(sessionId);

          // Invoke the review agent
          await this.invokeReviewAgent(session);

          return {
            sessionId,
            taskId,
            idleDetected: true,
          };
        }

        // Wait before checking again
        await this.delay(this.pollIntervalMs, signal);
      }

      // Aborted
      return {
        sessionId,
        taskId,
        idleDetected: false,
        reason: "aborted",
      };
    } catch (error) {
      this.abortControllers.delete(sessionId);
      throw error;
    }
  }

  /**
   * Check if a session is currently idle.
   *
   * @param sessionId - The session ID to check
   * @returns true if the session is idle
   */
  private async checkSessionIdle(sessionId: string): Promise<boolean> {
    try {
      // Get all sessions and find the one we're looking for
      const sessions = await this.sessionManager.getAllSessions();
      const session = sessions.find((s) => s.sessionId === sessionId);

      if (!session) {
        log.log(`[review-agent] Session ${sessionId} not found, considering it stopped`);
        return true; // Consider stopped sessions as "idle"
      }

      // Check if session is stopped
      if (session.status === "stopped") {
        return true;
      }

      // TODO: In the future, we may want to query the actual session status
      // from the OpenCode server using an events stream or status endpoint.
      // For now, we rely on the session status field in our local tracking.

      return false;
    } catch (error) {
      log.error(`[review-agent] Error checking session ${sessionId} status:`, error);
      return false;
    }
  }

  /**
   * Invoke the review agent for a completed session.
   * TODO: Implement actual review agent invocation
   *
   * @param session - The agent session that has become idle
   */
  private async invokeReviewAgent(session: AgentSession): Promise<void> {
    const { sessionId, taskId, workingDirectory } = session;

    // TODO: Implement actual review agent invocation
    // This should:
    // 1. Create a new review session or use an existing review agent
    // 2. Pass the completed task information
    // 3. Trigger the review process

    log.log(`[review-agent] TODO: Invoke review agent for task ${taskId} (session ${sessionId})`);
    log.log(`[review-agent] Working directory: ${workingDirectory}`);

    // Placeholder for future implementation
    // await this.sessionManager.createReviewSession(taskId, workingDirectory);
  }

  /**
   * Utility method to create a delay that can be aborted.
   *
   * @param ms - Milliseconds to delay
   * @param signal - Abort signal
   * @returns Promise that resolves after the delay or rejects if aborted
   */
  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error("Aborted"));
        return;
      }

      const timeout = setTimeout(resolve, ms);

      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Aborted"));
      });
    });
  }
}
