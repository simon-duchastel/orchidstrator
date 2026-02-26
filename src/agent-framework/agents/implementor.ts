/**
 * Implementor Agent
 *
 * Handles the implementation phase of a task.
 * Creates and manages its own agent instance with the implementor system prompt.
 * Reports back to orchestrator when complete.
 * Worktree is managed by the orchestrator.
 */

import { TaskManager, type Task as DysonTask } from "dyson-swarm";
import { type AgentInstance } from "./interface/types.js";
import type { AgentInstanceManager } from "./interface/index.js";
import { 
  fillImplementorAgentPromptTemplate, 
  getImplementorSystemPrompt 
} from "../../templates/index.js";
import { log } from "../../core/logging/index.js";

export interface ImplementorAgentOptions {
  taskId: string;
  dysonTask: DysonTask;
  worktreePath: string;
  agentInstanceManager: AgentInstanceManager;
  taskManager: TaskManager;
  onComplete: (taskId: string) => void;
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
 * Worktree is provided by the orchestrator, but agent instance is managed by the agent.
 */
export class ImplementorAgentImpl implements ImplementorAgent {
  readonly agentId: string;
  readonly taskId: string;
  private dysonTask: DysonTask;
  private worktreePath: string;
  private agentInstance: AgentInstance | undefined;
  private agentInstanceManager: AgentInstanceManager;
  private taskManager: TaskManager;
  private onComplete: (taskId: string) => void;
  private onError: (taskId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: ImplementorAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-implementor`;
    this.dysonTask = options.dysonTask;
    this.worktreePath = options.worktreePath;
    this.agentInstanceManager = options.agentInstanceManager;
    this.taskManager = options.taskManager;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Start the implementor agent.
   * Creates its own agent instance with implementor system prompt, assigns task, then sends initial prompt.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[implementor] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[implementor] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      // Create agent instance with implementor system prompt
      this.agentInstance = await this.agentInstanceManager.createAgentInstance({
        taskId: this.taskId,
        workingDirectory: this.worktreePath,
        systemPrompt: getImplementorSystemPrompt(),
      });
      log.log(`[implementor] Created agent instance ${this.agentInstance.instanceId} for task ${this.taskId}`);
      
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
   * Cleans up its own agent instance.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[implementor] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    
    // Clean up agent instance if it exists
    if (this.agentInstance) {
      try {
        await this.agentInstanceManager.removeAgentInstance(this.taskId);
        log.log(`[implementor] Removed agent instance for task ${this.taskId}`);
      } catch (error) {
        log.error(`[implementor] Failed to remove agent instance for task ${this.taskId}:`, error);
      }
      this.agentInstance = undefined;
    }
    
    log.log(`[implementor] Agent ${this.agentId} stopped`);
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get the agent instance
   */
  getAgentInstance(): AgentInstance | undefined {
    return this.agentInstance;
  }

  /**
   * Handle agent instance idle event - called by orchestrator when agent instance becomes idle
   */
  async handleAgentInstanceIdle(): Promise<void> {
    if (!this.agentInstance) {
      log.error(`[implementor] No agent instance available for task ${this.taskId}`);
      return;
    }
    
    log.log(`[implementor] Agent instance ${this.agentInstance.instanceId} became idle for task ${this.taskId}`);
    
    this._isRunning = false;
    
    // Clean up agent instance
    try {
      await this.agentInstanceManager.removeAgentInstance(this.taskId);
      log.log(`[implementor] Removed agent instance for task ${this.taskId}`);
    } catch (error) {
      log.error(`[implementor] Failed to remove agent instance for task ${this.taskId}:`, error);
    }
    this.agentInstance = undefined;
    
    // Notify completion
    this.onComplete(this.taskId);
  }

  private async sendInitialPrompt(): Promise<void> {
    if (!this.agentInstance) {
      throw new Error("Agent instance not available");
    }
    
    try {
      const promptMessage = fillImplementorAgentPromptTemplate({
        taskTitle: this.dysonTask.frontmatter.title || "",
        taskDescription: this.dysonTask.description || "",
        worktreePath: this.worktreePath,
      });

      await this.agentInstanceManager.sendMessage(
        this.agentInstance.instanceId,
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
