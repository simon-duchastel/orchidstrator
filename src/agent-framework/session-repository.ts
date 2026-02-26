/**
 * Session Repository
 *
 * Manages sessions for agents. Sessions are stored in .orchid/sessions/<taskid>/
 * with filenames like implementor-1.json, reviewer-1.json, etc.
 *
 * The Session object abstracts the underlying session file details.
 */

import { join } from "node:path";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { AgentType } from "./agent-type.js";

export { AgentType };

/**
 * Represents a session for an agent.
 * Abstracts the underlying session file details.
 */
export class Session {
  readonly taskId: string;
  readonly agentType: AgentType;
  readonly version: number;
  readonly sessionFilePath: string;

  constructor(taskId: string, agentType: AgentType, version: number, sessionFilePath: string) {
    this.taskId = taskId;
    this.agentType = agentType;
    this.version = version;
    this.sessionFilePath = sessionFilePath;
  }

  /**
   * Get the filename for this session (e.g., "implementor-1")
   */
  get filename(): string {
    return `${this.agentType}-${this.version}`;
  }

  /**
   * Get the full path to the session file
   */
  get filePath(): string {
    return this.sessionFilePath;
  }
}

export interface SessionRepositoryOptions {
  /** Base directory for all sessions (e.g., .orchid/sessions) */
  sessionsDir: string;
}

/**
 * Repository for managing agent sessions.
 * Sessions are stored in .orchid/sessions/<taskid>/<agent-type>-<version>.json
 */
export class SessionRepository {
  private sessionsDir: string;

  constructor(options: SessionRepositoryOptions) {
    this.sessionsDir = options.sessionsDir;

    // Ensure the sessions directory exists
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Get or create a session for a task and agent type.
   * If existing sessions exist, picks the one with the largest version number.
   * If no sessions exist, creates a new one with version 1.
   *
   * @param taskId - The task identifier
   * @param agentType - The type of agent (implementor, reviewer, merger)
   * @returns A Session object
   */
  getOrCreateSession(taskId: string, agentType: AgentType): Session {
    const taskSessionsDir = join(this.sessionsDir, taskId);

    // Ensure task directory exists
    if (!existsSync(taskSessionsDir)) {
      mkdirSync(taskSessionsDir, { recursive: true });
    }

    // Find existing sessions for this agent type
    const existingVersion = this.findLatestSessionVersion(taskId, agentType);

    if (existingVersion !== null) {
      // Use existing session
      const sessionFilePath = join(taskSessionsDir, `${agentType}-${existingVersion}.json`);
      return new Session(taskId, agentType, existingVersion, sessionFilePath);
    }

    // Create new session with version 1
    const version = 1;
    const sessionFilePath = join(taskSessionsDir, `${agentType}-${version}.json`);
    return new Session(taskId, agentType, version, sessionFilePath);
  }

  /**
   * Find the latest session version for a task and agent type.
   * Returns null if no sessions exist.
   *
   * @param taskId - The task identifier
   * @param agentType - The type of agent
   * @returns The highest version number, or null if none exist
   */
  private findLatestSessionVersion(taskId: string, agentType: AgentType): number | null {
    const taskSessionsDir = join(this.sessionsDir, taskId);

    if (!existsSync(taskSessionsDir)) {
      return null;
    }

    const files = readdirSync(taskSessionsDir);
    const pattern = new RegExp(`^${agentType}-(\\d+)\\.json$`);

    let maxVersion: number | null = null;

    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const version = parseInt(match[1], 10);
        if (maxVersion === null || version > maxVersion) {
          maxVersion = version;
        }
      }
    }

    return maxVersion;
  }

  /**
   * Get the path to the sessions directory for a task
   */
  getTaskSessionsDir(taskId: string): string {
    return join(this.sessionsDir, taskId);
  }
}

/**
 * Factory function to create a SessionRepository
 */
export function createSessionRepository(options: SessionRepositoryOptions): SessionRepository {
  return new SessionRepository(options);
}
