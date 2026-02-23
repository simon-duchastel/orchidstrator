/**
 * OpenCode Session Manager
 *
 * Manages individual OpenCode sessions for each agent using the SDK's Session API.
 * Uses the OpenCode server as the source of truth for session state.
 */

import { createOpencodeClient, type OpencodeClient, type Session } from "@opencode-ai/sdk";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { log } from "../../core/logging/logger.js";

export interface AgentSession {
  /** Unique session identifier (from OpenCode) */
  sessionId: string;
  /** The task/agent this session belongs to */
  taskId: string;
  /** Path to the session's working directory (the worktree) */
  workingDirectory: string;
  /** The OpenCode client instance */
  client: OpencodeClient;
  /** When the session was created */
  createdAt: Date;
  /** Session status */
  status: "running" | "stopping" | "stopped";
}

export interface OpencodeSessionManagerOptions {
  /** Base directory for all sessions (typically the worktrees directory) */
  sessionsDir: string;
  /** Base URL for the OpenCode server (required) */
  baseUrl: string;
}

/**
 * Manages OpenCode sessions for agents.
 *
 * Uses the OpenCode server as the source of truth for session state.
 * All session queries go directly to the SDK rather than maintaining local state.
 */
export class OpencodeSessionManager {
  private sessionsDir: string;
  private client: OpencodeClient;

  constructor(options: OpencodeSessionManagerOptions) {
    this.sessionsDir = options.sessionsDir;
    this.client = createOpencodeClient({
      baseUrl: options.baseUrl,
    });

    // Ensure the sessions directory exists
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Get the OpenCode client instance.
   *
   * @returns The OpenCode client
   */
  getClient(): OpencodeClient {
    return this.client;
  }

  /**
   * Create a new OpenCode session for an agent.
   *
   * @param taskId - The task ID (used as the session identifier base)
   * @returns The created session info
   * @throws Error if session already exists or creation fails
   */

  async createSession(taskId: string): Promise<AgentSession> {
    // Check if session already exists by querying the server
    const existingSession = await this.getSession(taskId);
    if (existingSession) {
      throw new Error(`Session for task ${taskId} already exists`);
    }

    const workingDirectory = join(this.sessionsDir, taskId);

    // Ensure the working directory exists (should be created by worktree manager first)
    if (!existsSync(workingDirectory)) {
      mkdirSync(workingDirectory, { recursive: true });
    }

    try {
      // Create a new session via the SDK
      const createResponse = await this.client.session.create({
        query: {
          directory: workingDirectory,
        },
        body: {
          title: taskId,
        },
      });

      if (createResponse.error) {
        throw new Error(`Failed to create session: ${createResponse.error}`);
      }

      // Extract the session ID from the response
      const sessionId = this.extractSessionId(createResponse.data);

      if (!sessionId) {
        throw new Error("Failed to get session ID from create response");
      }

      return {
        sessionId,
        taskId,
        workingDirectory,
        client: this.client,
        createdAt: new Date(),
        status: "running",
      };
    } catch (error) {
      throw new Error(
        `Failed to create session for task ${taskId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract session ID from the create response.
   * Handles different response formats based on SDK version.
   */
  private extractSessionId(data: unknown): string | undefined {
    if (!data) return undefined;

    // Try different possible response structures
    if (typeof data === "object") {
      // Direct ID field
      if ("id" in data && typeof (data as Record<string, unknown>).id === "string") {
        return (data as Record<string, unknown>).id as string;
      }
      // Nested in data field
      if ("data" in data && typeof (data as Record<string, unknown>).data === "object") {
        const nestedData = (data as Record<string, unknown>).data as Record<string, unknown>;
        if (nestedData && "id" in nestedData && typeof nestedData.id === "string") {
          return nestedData.id;
        }
      }
      // Session ID field
      if ("sessionId" in data && typeof (data as Record<string, unknown>).sessionId === "string") {
        return (data as Record<string, unknown>).sessionId as string;
      }
    }

    return undefined;
  }

  /**
   * Get a session by task ID.
   * Queries the OpenCode server for the session.
   *
   * @param taskId - The task identifier
   * @returns The session info or undefined if not found
   */
  async getSession(taskId: string): Promise<AgentSession | undefined> {
    try {
      const response = await this.client.session.list({});

      if (response.error || !response.data) {
        return undefined;
      }

      const sessions = response.data as Session[];
      const session = sessions.find((s) => s.title === taskId);

      if (!session) {
        return undefined;
      }

      const workingDirectory = join(this.sessionsDir, taskId);

      return {
        sessionId: session.id,
        taskId,
        workingDirectory,
        client: this.client,
        createdAt: new Date(session.time.created * 1000),
        status: "running",
      };
    } catch (error) {
      log.error(`[session-manager] Error getting session for task ${taskId}:`, error);
      return undefined;
    }
  }

  /**
   * Get all active sessions.
   * Queries the OpenCode server for all sessions.
   *
   * @returns Array of all session info
   */
  async getAllSessions(): Promise<AgentSession[]> {
    try {
      const response = await this.client.session.list({});

      if (response.error || !response.data) {
        return [];
      }

      const sessions = response.data as Session[];

      return sessions.map((session) => ({
        sessionId: session.id,
        taskId: session.title,
        workingDirectory: join(this.sessionsDir, session.title),
        client: this.client,
        createdAt: new Date(session.time.created * 1000),
        status: "running",
      }));
    } catch (error) {
      log.error("[session-manager] Error getting all sessions:", error);
      return [];
    }
  }

  /**
   * Check if a session exists for a task.
   * Queries the OpenCode server to verify.
   *
   * @param taskId - The task identifier
   * @returns true if the session exists
   */
  async hasSession(taskId: string): Promise<boolean> {
    const session = await this.getSession(taskId);
    return session !== undefined;
  }

  /**
   * Remove a session.
   *
   * @param taskId - The task identifier
   * @throws Error if session doesn't exist
   */
  async removeSession(taskId: string): Promise<void> {
    const session = await this.getSession(taskId);
    if (!session) {
      throw new Error(`Session for task ${taskId} not found`);
    }

    try {
      // Delete the session via the SDK
      await this.client.session.delete({
        path: {
          id: session.sessionId,
        },
        query: {
          directory: session.workingDirectory,
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to delete session ${session.sessionId} for task ${taskId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Stop all active sessions.
   * Queries the server for all sessions and removes them.
   */
  async stopAllSessions(): Promise<void> {
    const sessions = await this.getAllSessions();
    await Promise.all(
      sessions.map((session) =>
        this.removeSession(session.taskId).catch((error) => {
          log.error(`[session-manager] Error stopping session ${session.sessionId}:`, error);
        })
      )
    );
  }

  /**
   * Send a message to a session.
   *
   * @param sessionId - The session ID
   * @param message - The message text to send
   * @param workingDirectory - The working directory for the session
   * @throws Error if message sending fails
   */
  async sendMessage(
    sessionId: string,
    message: string,
    workingDirectory: string
  ): Promise<void> {
    try {
      await this.client.session.prompt({
        path: {
          id: sessionId,
        },
        query: {
          directory: workingDirectory,
        },
        body: {
          parts: [
            {
              type: "text",
              text: message,
            },
          ],
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to send message to session ${sessionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

}
