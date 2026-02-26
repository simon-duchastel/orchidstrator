/**
 * Reviewer Agent
 *
 * Handles the review phase of a task.
 * Creates and manages its own session with the reviewer system prompt.
 * Reports back to orchestrator when complete.
 * Worktree is managed by the orchestrator.
 */

import { type Task as DysonTask } from "dyson-swarm";
import { type AgentSession } from "./interface/types.js";
import type { SessionManagerInterface } from "./interface/index.js";
import { 
  fillReviewerPromptTemplate,
  getReviewerSystemPrompt 
} from "../../templates/index.js";
import { log } from "../../core/logging/index.js";

export interface ReviewerAgentOptions {
  taskId: string;
  dysonTask: DysonTask;
  worktreePath: string;
  sessionManager: SessionManagerInterface;
  onComplete: (taskId: string) => void;
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
 * Worktree is provided by the orchestrator, but session is managed by the agent.
 */
export class ReviewerAgentImpl implements ReviewerAgent {
  readonly agentId: string;
  readonly taskId: string;
  private dysonTask: DysonTask;
  private worktreePath: string;
  private session: AgentSession | undefined;
  private sessionManager: SessionManagerInterface;
  private onComplete: (taskId: string) => void;
  private onError: (taskId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: ReviewerAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-reviewer`;
    this.dysonTask = options.dysonTask;
    this.worktreePath = options.worktreePath;
    this.sessionManager = options.sessionManager;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Start the reviewer agent.
   * Creates its own session with reviewer system prompt, then sends initial prompt.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[reviewer] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[reviewer] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      // Create session with reviewer system prompt
      this.session = await this.sessionManager.createSession({
        taskId: this.taskId,
        workingDirectory: this.worktreePath,
        systemPrompt: getReviewerSystemPrompt(),
      });
      log.log(`[reviewer] Created session ${this.session.sessionId} for task ${this.taskId}`);
      
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
   * Cleans up its own session.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[reviewer] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    
    // Clean up session if it exists
    if (this.session) {
      try {
        await this.sessionManager.removeSession(this.taskId);
        log.log(`[reviewer] Removed session for task ${this.taskId}`);
      } catch (error) {
        log.error(`[reviewer] Failed to remove session for task ${this.taskId}:`, error);
      }
      this.session = undefined;
    }
    
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
    if (!this.session) {
      log.error(`[reviewer] No session available for task ${this.taskId}`);
      return;
    }
    
    log.log(`[reviewer] Session ${this.session.sessionId} became idle for task ${this.taskId}`);
    
    this._isRunning = false;
    
    // Clean up session
    try {
      await this.sessionManager.removeSession(this.taskId);
      log.log(`[reviewer] Removed session for task ${this.taskId}`);
    } catch (error) {
      log.error(`[reviewer] Failed to remove session for task ${this.taskId}:`, error);
    }
    this.session = undefined;
    
    // Notify completion
    this.onComplete(this.taskId);
  }

  private async sendInitialPrompt(): Promise<void> {
    if (!this.session) {
      throw new Error("Session not available");
    }
    
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
