/**
 * Merger Agent
 *
 * Handles the merge phase of a task.
 * Creates and manages its own agent instance with the merger system prompt.
 * Reports back to orchestrator when complete.
 * Worktree is managed by the orchestrator.
 */

import type { AgentInstance, AgentInstanceManager } from "./interface/index.js";
import { 
  fillMergerPromptTemplate,
  getMergerSystemPrompt 
} from "../../templates/index.js";
import { log } from "../../core/logging/index.js";

export interface MergerAgentOptions {
  taskId: string;
  worktreePath: string;
  agentInstanceManager: AgentInstanceManager;
  onComplete: (taskId: string) => void;
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
 * Worktree is provided by the orchestrator, but agent instance is managed by the agent.
 */
export class MergerAgentImpl implements MergerAgent {
  readonly agentId: string;
  readonly taskId: string;
  private worktreePath: string;
  private agentInstance: AgentInstance | undefined;
  private agentInstanceManager: AgentInstanceManager;
  private onComplete: (taskId: string) => void;
  private onError: (taskId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: MergerAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-merger`;
    this.worktreePath = options.worktreePath;
    this.agentInstanceManager = options.agentInstanceManager;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  /**
   * Start the merger agent.
   * Creates its own agent instance with merger system prompt, then sends initial prompt.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[merger] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[merger] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      // Create agent instance with merger system prompt
      this.agentInstance = await this.agentInstanceManager.createAgentInstance({
        taskId: this.taskId,
        workingDirectory: this.worktreePath,
        systemPrompt: getMergerSystemPrompt(),
      });
      log.log(`[merger] Created agent instance ${this.agentInstance.instanceId} for task ${this.taskId}`);

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
   * Cleans up its own agent instance.
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[merger] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    
    // Clean up agent instance if it exists
    if (this.agentInstance) {
      try {
        await this.agentInstanceManager.removeAgentInstance(this.taskId);
        log.log(`[merger] Removed agent instance for task ${this.taskId}`);
      } catch (error) {
        log.error(`[merger] Failed to remove agent instance for task ${this.taskId}:`, error);
      }
      this.agentInstance = undefined;
    }
    
    log.log(`[merger] Agent ${this.agentId} stopped`);
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
      log.error(`[merger] No agent instance available for task ${this.taskId}`);
      return;
    }
    
    log.log(`[merger] Agent instance ${this.agentInstance.instanceId} became idle for task ${this.taskId}`);

    this._isRunning = false;

    // Clean up agent instance
    try {
      await this.agentInstanceManager.removeAgentInstance(this.taskId);
      log.log(`[merger] Removed agent instance for task ${this.taskId}`);
    } catch (error) {
      log.error(`[merger] Failed to remove agent instance for task ${this.taskId}:`, error);
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
      const promptMessage = fillMergerPromptTemplate({
        taskId: this.taskId,
        worktreePath: this.worktreePath,
      });

      await this.agentInstanceManager.sendMessage(
        this.agentInstance.instanceId,
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
