/**
 * Reviewer Agent
 *
 * Handles the review phase of a task.
 * Sends initial prompt to an existing session in a pre-created worktree.
 * Reports back to orchestrator when complete.
 * Worktree and session are managed by the orchestrator.
 */

import { type Task as DysonTask } from "dyson-swarm";
import { type AgentSession } from "./interface/types.js";
import type { SessionManagerInterface } from "./interface/index.js";
import { fillReviewerPromptTemplate } from "../../templates/index.js";
import { log } from "../../core/logging/index.js";

export interface ReviewerAgentOptions {
  taskId: string;
  dysonTask: DysonTask;
  worktreePath: string;
  session: AgentSession;
  sessionManager: SessionManagerInterface;
  onComplete: (taskId: string, session: AgentSession) => void;
  onError: (taskId: string, error: Error) => void;
}

export interface ReviewerAgent {
  readonly agentId: string;
  readonly taskId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/**
 * ReviewerAgent handles the review phase of a task.
 * Created per-task and destroyed when review is complete.
 * Worktree and session are provided by the orchestrator.
 */
export class ReviewerAgentImpl implements ReviewerAgent {
  readonly agentId: string;
  readonly taskId: string;
  private dysonTask: DysonTask;
  private worktreePath: string;
  private session: AgentSession;
  private sessionManager: SessionManagerInterface;
  private onComplete: (taskId: string, session: AgentSession) => void;
  private onError: (taskId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: ReviewerAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-reviewer`;
    this.dysonTask = options.dysonTask;
    this.worktreePath = options.worktreePath;
    this.session = options.session;
    this.sessionManager = options.sessionManager;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Start the reviewer agent.
   * Sends initial prompt to begin the review.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[reviewer] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[reviewer] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      // Send initial prompt
      await this.sendInitialPrompt();
      
      log.log(`[reviewer] Agent ${this.agentId} started successfully`);
    } catch (error) {
      log.error(`[reviewer] Failed to start agent ${this.agentId}:`, error);
      this._isRunning = false;
      this.onError(this.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop the reviewer agent.
   * Note: Session and worktree cleanup are handled by the orchestrator.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[reviewer] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    log.log(`[reviewer] Agent ${this.agentId} stopped`);
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
    log.log(`[reviewer] Session ${this.session.sessionId} became idle for task ${this.taskId}`);
    
    this._isRunning = false;
    
    // Notify completion
    this.onComplete(this.taskId, this.session);
  }

  private async sendInitialPrompt(): Promise<void> {
    try {
      const promptMessage = fillReviewerPromptTemplate({
        taskTitle: this.dysonTask.frontmatter.title || "",
        taskDescription: this.dysonTask.description || "",
        worktreePath: this.worktreePath,
      });

      await this.sessionManager.sendMessage(
        this.session.sessionId,
        promptMessage,
        this.worktreePath
      );
      log.log(`[reviewer] Sent initial prompt`);
    } catch (error) {
      throw new Error(
        `Failed to send initial prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

}

/**
 * Factory function to create a ReviewerAgent
 */
export function createReviewerAgent(options: ReviewerAgentOptions): ReviewerAgent {
  return new ReviewerAgentImpl(options);
}
