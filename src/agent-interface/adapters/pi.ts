/**
 * Pi Session Adapter
 *
 * Implements SessionManagerInterface using the @mariozechner/pi-coding-agent SDK.
 */

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  createAgentSession,
  type AgentSession,
  type CreateAgentSessionResult,
} from "@mariozechner/pi-coding-agent";
import {
  type SessionManagerInterface,
  type AgentSession as OrchidAgentSession,
  type SessionIdleCallback,
  type CreateSessionOptions,
} from "../types.js";

export interface PiSessionAdapterOptions {
  /** Base directory for all sessions */
  sessionsDir: string;
}

/**
 * Pi session info stored in adapter
 */
interface PiSessionInfo {
  sessionId: string;
  taskId: string;
  workingDirectory: string;
  createdAt: Date;
  status: "running" | "stopping" | "stopped";
  /** Pi SDK session instance */
  piSession: AgentSession;
  /** Unsubscribe function for event listener */
  unsubscribe: () => void;
}

/**
 * Adapter that implements SessionManagerInterface using Pi SDK.
 */
export class PiSessionAdapter implements SessionManagerInterface {
  private sessionsDir: string;
  private sessions: Map<string, PiSessionInfo> = new Map();
  private idleCallbacks: SessionIdleCallback[] = [];

  constructor(options: PiSessionAdapterOptions) {
    this.sessionsDir = options.sessionsDir;

    // Ensure the sessions directory exists
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Create a new session for an agent.
   */
  async createSession(options: CreateSessionOptions): Promise<OrchidAgentSession> {
    // Check if session already exists
    if (this.sessions.has(options.taskId)) {
      throw new Error(`Session for task ${options.taskId} already exists`);
    }

    // Ensure the working directory exists
    if (!existsSync(options.workingDirectory)) {
      mkdirSync(options.workingDirectory, { recursive: true });
    }

    try {
      // Create Pi session using SDK
      const result: CreateAgentSessionResult = await createAgentSession({
        cwd: options.workingDirectory,
      });

      const sessionId = `pi-${options.taskId}-${Date.now()}`;

      // Subscribe to events to detect when session becomes idle
      const unsubscribe = result.session.subscribe((event) => {
        // Check for events that indicate the agent has finished processing
        if (event.type === "message_end" || event.type === "turn_end") {
          const sessionInfo = this.sessions.get(options.taskId);
          if (sessionInfo) {
            this.triggerSessionIdle(options.taskId, {
              sessionId: sessionInfo.sessionId,
              taskId: sessionInfo.taskId,
              workingDirectory: sessionInfo.workingDirectory,
              createdAt: sessionInfo.createdAt,
              status: "running",
            });
          }
        }
      });

      const sessionInfo: PiSessionInfo = {
        sessionId,
        taskId: options.taskId,
        workingDirectory: options.workingDirectory,
        createdAt: new Date(),
        status: "running",
        piSession: result.session,
        unsubscribe,
      };

      this.sessions.set(options.taskId, sessionInfo);

      return {
        sessionId,
        taskId: options.taskId,
        workingDirectory: options.workingDirectory,
        createdAt: sessionInfo.createdAt,
        status: "running",
      };
    } catch (error) {
      throw new Error(
        `Failed to create Pi session for task ${options.taskId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get a session by task ID.
   */
  async getSession(taskId: string): Promise<OrchidAgentSession | undefined> {
    const sessionInfo = this.sessions.get(taskId);
    if (!sessionInfo) {
      return undefined;
    }

    return {
      sessionId: sessionInfo.sessionId,
      taskId: sessionInfo.taskId,
      workingDirectory: sessionInfo.workingDirectory,
      createdAt: sessionInfo.createdAt,
      status: sessionInfo.status,
    };
  }

  /**
   * Send a message to a session.
   * For Pi, this uses session.prompt() to send a message to the agent.
   */
  async sendMessage(
    sessionId: string,
    message: string,
    _workingDirectory: string
  ): Promise<void> {
    // Find session by sessionId
    let sessionInfo: PiSessionInfo | undefined;
    for (const [, info] of this.sessions) {
      if (info.sessionId === sessionId) {
        sessionInfo = info;
        break;
      }
    }

    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Send message to the Pi agent using prompt()
      // The agent will process it and emit events that we subscribe to
      await sessionInfo.piSession.prompt(message);
    } catch (error) {
      throw new Error(
        `Failed to send message to Pi session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Register a callback for session idle events.
   * For Pi, this is triggered when the agent finishes processing (message_end event).
   */
  onSessionIdle(callback: SessionIdleCallback): void {
    this.idleCallbacks.push(callback);
  }

  /**
   * Trigger idle callbacks - called when a session becomes idle.
   */
  private triggerSessionIdle(taskId: string, session: OrchidAgentSession): void {
    for (const callback of this.idleCallbacks) {
      try {
        callback(taskId, session);
      } catch (error) {
        // Log but don't let one callback failure stop others
        console.error("Error in session idle callback:", error);
      }
    }
  }
}

/**
 * Factory function to create a PiSessionAdapter
 */
export function createPiSessionAdapter(
  options: PiSessionAdapterOptions
): PiSessionAdapter {
  return new PiSessionAdapter(options);
}
