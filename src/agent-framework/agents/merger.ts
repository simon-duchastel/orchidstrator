/**
 * Merger Agent
 *
 * Handles the merge phase of a task.
 * Merges changes from the worktree back into mainline.
 * Reports back to orchestrator when complete.
 * Worktree is managed by the orchestrator.
 */

import type { AgentSession, SessionManagerInterface } from "./interface/index.js";
import { fillMergerPromptTemplate } from "../../templates/index.js";
import { log } from "../../core/logging/index.js";

export interface MergerAgentOptions {
  taskId: string;
  worktreePath: string;
  session: AgentSession;
  sessionManager: SessionManagerInterface;
  onComplete: (taskId: string, session: AgentSession) => void;
  onError: (taskId: string, error: Error) => void;
}

export interface MergerAgent {
  readonly agentId: string;
  readonly taskId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/**
 * MergerAgent handles the merge phase of a task.
 */
export class MergerAgentImpl implements MergerAgent {
  readonly agentId: string;
  readonly taskId: string;
  private worktreePath: string;
  private session: AgentSession;
  private sessionManager: SessionManagerInterface;
  private onComplete: (taskId: string, session: AgentSession) => void;
  private onError: (taskId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: MergerAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-merger`;
    this.worktreePath = options.worktreePath;
    this.session = options.session;
    this.sessionManager = options.sessionManager;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Start the merger agent.
   * Sends initial prompt to begin the merge.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[merger] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[merger] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      // Send initial prompt
      await this.sendInitialPrompt();

      log.log(`[merger] Agent ${this.agentId} started successfully`);
    } catch (error) {
      log.error(`[merger] Failed to start agent ${this.agentId}:`, error);
      this._isRunning = false;
      this.onError(this.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop the merger agent.
   * Note: Session and worktree cleanup are handled by the orchestrator.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[merger] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    log.log(`[merger] Agent ${this.agentId} stopped`);
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get the session
   */
  getSession(): AgentSession | undefined {
    return this.session;
  }

  /**
   * Handle session idle event - called by orchestrator when session becomes idle
   */
  async handleSessionIdle(): Promise<void> {
    log.log(`[merger] Session ${this.session.sessionId} became idle for task ${this.taskId}`);

    this._isRunning = false;

    // Notify completion
    this.onComplete(this.taskId, this.session);
  }

  private async sendInitialPrompt(): Promise<void> {
    try {
      const promptMessage = fillMergerPromptTemplate({
        taskId: this.taskId,
        worktreePath: this.worktreePath,
      });

      await this.sessionManager.sendMessage(
        this.session.sessionId,
        promptMessage,
        this.worktreePath
      );
      log.log(`[merger] Sent initial prompt`);
    } catch (error) {
      throw new Error(
        `Failed to send initial prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Factory function to create a MergerAgent
 */
export function createMergerAgent(options: MergerAgentOptions): MergerAgent {
  return new MergerAgentImpl(options);
}
