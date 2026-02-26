/**
 * Implementor Agent
 *
 * Handles the implementation phase of a task.
 * Sends initial prompt to an existing session in a pre-created worktree.
 * Reports back to orchestrator when complete.
 * Worktree and session are managed by the orchestrator.
 */

import { TaskManager, type Task as DysonTask } from "dyson-swarm";
import { type AgentSession } from "../agent-interface/types.js";
import type { SessionManagerInterface } from "../agent-interface/index.js";
import { fillImplementorAgentPromptTemplate } from "../templates/index.js";
import { log } from "../core/logging/index.js";
import type { Task } from "../tasks/index.js";

export interface ImplementorAgentOptions {
  taskId: string;
  dysonTask: DysonTask;
  worktreePath: string;
  session: AgentSession;
  sessionManager: SessionManagerInterface;
  taskManager: TaskManager;
  onComplete: (taskId: string, session: AgentSession) => void;
  onError: (taskId: string, error: Error) => void;
}

export interface ImplementorAgent {
  readonly agentId: string;
  readonly taskId: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/**
 * ImplementorAgent handles the implementation phase of a task.
 * Created per-task and destroyed when implementation is complete.
 * Worktree and session are provided by the orchestrator.
 */
export class ImplementorAgentImpl implements ImplementorAgent {
  readonly agentId: string;
  readonly taskId: string;
  private dysonTask: DysonTask;
  private worktreePath: string;
  private session: AgentSession;
  private sessionManager: SessionManagerInterface;
  private taskManager: TaskManager;
  private onComplete: (taskId: string, session: AgentSession) => void;
  private onError: (taskId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: ImplementorAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-implementor`;
    this.dysonTask = options.dysonTask;
    this.worktreePath = options.worktreePath;
    this.session = options.session;
    this.sessionManager = options.sessionManager;
    this.taskManager = options.taskManager;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Start the implementor agent.
   * Assigns task first, then sends initial prompt.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[implementor] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[implementor] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      // Assign task in dyson-swarm first to prevent conflicts
      await this.assignTask();
      
      // Send initial prompt
      await this.sendInitialPrompt();
      
      log.log(`[implementor] Agent ${this.agentId} started successfully`);
    } catch (error) {
      log.error(`[implementor] Failed to start agent ${this.agentId}:`, error);
      await this.cleanup();
      this._isRunning = false;
      this.onError(this.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop the implementor agent.
   * Note: Session and worktree cleanup are handled by the orchestrator.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[implementor] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    log.log(`[implementor] Agent ${this.agentId} stopped`);
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
    log.log(`[implementor] Session ${this.session.sessionId} became idle for task ${this.taskId}`);
    
    this._isRunning = false;
    
    // Notify completion
    this.onComplete(this.taskId, this.session);
  }

  private async sendInitialPrompt(): Promise<void> {
    try {
      const promptMessage = fillImplementorAgentPromptTemplate({
        taskTitle: this.dysonTask.frontmatter.title || "",
        taskDescription: this.dysonTask.description || "",
        worktreePath: this.worktreePath,
      });

      await this.sessionManager.sendMessage(
        this.session.sessionId,
        promptMessage,
        this.worktreePath
      );
      log.log(`[implementor] Sent initial prompt`);
    } catch (error) {
      throw new Error(
        `Failed to send initial prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async assignTask(): Promise<void> {
    try {
      await this.taskManager.assignTask(this.taskId, this.agentId);
      log.log(`[implementor] Assigned task ${this.taskId} to agent ${this.agentId}`);
    } catch (error) {
      // Don't fail if assignment fails - it's optional
      log.warn(`[implementor] Failed to assign task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cleanup(): Promise<void> {
    // Unassign task - this is handled by the agent
    try {
      await this.taskManager.unassignTask(this.taskId);
    } catch (error) {
      log.error(`[implementor] Failed to unassign task:`, error);
    }
  }
}

/**
 * Factory function to create an ImplementorAgent
 */
export function createImplementorAgent(options: ImplementorAgentOptions): ImplementorAgent {
  return new ImplementorAgentImpl(options);
}
