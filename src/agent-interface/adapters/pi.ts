/**
 * Pi Session Adapter
 *
 * Implements SessionManagerInterface using the @mariozechner/pi-coding-agent SDK.
 */

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  createAgentSession,
  DefaultResourceLoader,
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
  sessionsDir: string;
}

interface PiSessionInfo {
  sessionId: string;
  taskId: string;
  workingDirectory: string;
  createdAt: Date;
  status: "running" | "stopping" | "stopped";
  piSession: AgentSession;
  unsubscribe: () => void;
}

export class PiSessionAdapter implements SessionManagerInterface {
  private sessionsDir: string;
  private sessions: Map<string, PiSessionInfo> = new Map();
  private idleCallbacks: SessionIdleCallback[] = [];

  constructor(options: PiSessionAdapterOptions) {
    this.sessionsDir = options.sessionsDir;
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Create a new session for an agent.
   */
  async createSession(options: CreateSessionOptions): Promise<OrchidAgentSession> {
    if (this.sessions.has(options.taskId)) {
      throw new Error(`Session for task ${options.taskId} already exists`);
    }

    if (!existsSync(options.workingDirectory)) {
      mkdirSync(options.workingDirectory, { recursive: true });
    }

    try {
      const resourceLoader = new DefaultResourceLoader({
        systemPromptOverride: () => options.systemPrompt,
        appendSystemPromptOverride: () => [],
      });
      await resourceLoader.reload();

      const result: CreateAgentSessionResult = await createAgentSession({
        cwd: options.workingDirectory,
        resourceLoader,
      });

      const sessionId = `pi-${options.taskId}-${Date.now()}`;

      const unsubscribe = result.session.subscribe((event) => {
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

  async sendMessage(
    sessionId: string,
    message: string,
    _workingDirectory: string
  ): Promise<void> {
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
      await sessionInfo.piSession.prompt(message);
    } catch (error) {
      throw new Error(
        `Failed to send message to Pi session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async removeSession(taskId: string): Promise<void> {
    const sessionInfo = this.sessions.get(taskId);
    if (!sessionInfo) {
      throw new Error(`Session for task ${taskId} not found`);
    }

    sessionInfo.unsubscribe();
    this.sessions.delete(taskId);
  }

  async stopAllSessions(): Promise<void> {
    for (const [, sessionInfo] of this.sessions) {
      sessionInfo.unsubscribe();
    }
    this.sessions.clear();
  }

  onSessionIdle(callback: SessionIdleCallback): void {
    this.idleCallbacks.push(callback);
  }

  private triggerSessionIdle(taskId: string, session: OrchidAgentSession): void {
    for (const callback of this.idleCallbacks) {
      try {
        callback(taskId, session);
      } catch (error) {
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
