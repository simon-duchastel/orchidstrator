/**
 * Reviewer Agent
 *
 * Handles the review phase of a task.
 * Creates and manages its own agent instance with the reviewer system prompt.
 * Reports back to orchestrator when complete.
 * Worktree is managed by the orchestrator.
 */

import { type Task as DysonTask } from "dyson-swarm";
import { type AgentInstance } from "./interface/types.js";
import type { AgentInstanceManager } from "./interface/index.js";
import { type SessionRepository } from "../session-repository.js";
import { AgentType } from "../agent-type.js";
import { 
  fillReviewerPromptTemplate,
  getReviewerSystemPrompt 
} from "../../templates/index.js";
import { log } from "../../core/logging/index.js";

export interface ReviewerAgentOptions {
  taskId: string;
  dysonTask: DysonTask;
  worktreePath: string;
  agentInstanceManager: AgentInstanceManager;
  sessionRepository: SessionRepository;
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

export class ReviewerAgentImpl implements ReviewerAgent {
  readonly agentId: string;
  readonly taskId: string;
  private dysonTask: DysonTask;
  private worktreePath: string;
  private agentInstance: AgentInstance | undefined;
  private agentInstanceManager: AgentInstanceManager;
  private sessionRepository: SessionRepository;
  private onComplete: (taskId: string) => void;
  private onError: (taskId: string, error: Error) => void;
  private _isRunning = false;

  constructor(options: ReviewerAgentOptions) {
    this.taskId = options.taskId;
    this.agentId = `${options.taskId}-reviewer`;
    this.dysonTask = options.dysonTask;
    this.worktreePath = options.worktreePath;
    this.agentInstanceManager = options.agentInstanceManager;
    this.sessionRepository = options.sessionRepository;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  async start(): Promise<void> {
    if (this._isRunning) {
      log.log(`[reviewer] Agent ${this.agentId} already running`);
      return;
    }

    this._isRunning = true;
    log.log(`[reviewer] Starting agent ${this.agentId} for task ${this.taskId}`);

    try {
      const session = this.sessionRepository.getOrCreateSession(this.taskId, AgentType.REVIEWER);
      log.log(`[reviewer] Using session ${session.filename} for task ${this.taskId}`);

      this.agentInstance = await this.agentInstanceManager.createAgentInstance({
        taskId: this.taskId,
        workingDirectory: this.worktreePath,
        systemPrompt: getReviewerSystemPrompt(),
        sessionFilePath: session.filePath,
      });
      log.log(`[reviewer] Created agent instance ${this.agentInstance.instanceId} for task ${this.taskId}`);
      
      await this.sendInitialPrompt();
      
      log.log(`[reviewer] Agent ${this.agentId} started successfully`);
    } catch (error) {
      log.error(`[reviewer] Failed to start agent ${this.agentId}:`, error);
      this._isRunning = false;
      this.onError(this.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    log.log(`[reviewer] Stopping agent ${this.agentId}`);
    this._isRunning = false;
    
    if (this.agentInstance) {
      try {
        await this.agentInstanceManager.removeAgentInstance(this.taskId);
        log.log(`[reviewer] Removed agent instance for task ${this.taskId}`);
      } catch (error) {
        log.error(`[reviewer] Failed to remove agent instance for task ${this.taskId}:`, error);
      }
      this.agentInstance = undefined;
    }
    
    log.log(`[reviewer] Agent ${this.agentId} stopped`);
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getAgentInstance(): AgentInstance | undefined {
    return this.agentInstance;
  }

  async handleAgentInstanceIdle(): Promise<void> {
    if (!this.agentInstance) {
      log.error(`[reviewer] No agent instance available for task ${this.taskId}`);
      return;
    }
    
    log.log(`[reviewer] Agent instance ${this.agentInstance.instanceId} became idle for task ${this.taskId}`);
    
    this._isRunning = false;
    
    try {
      await this.agentInstanceManager.removeAgentInstance(this.taskId);
      log.log(`[reviewer] Removed agent instance for task ${this.taskId}`);
    } catch (error) {
      log.error(`[reviewer] Failed to remove agent instance for task ${this.taskId}:`, error);
    }
    this.agentInstance = undefined;
    
    this.onComplete(this.taskId);
  }

  private async sendInitialPrompt(): Promise<void> {
    if (!this.agentInstance) {
      throw new Error("Agent instance not available");
    }
    
    try {
      const promptMessage = fillReviewerPromptTemplate({
        taskTitle: this.dysonTask.frontmatter.title || "",
        taskDescription: this.dysonTask.description || "",
        worktreePath: this.worktreePath,
      });

      await this.agentInstanceManager.sendMessage(
        this.agentInstance.instanceId,
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

export function createReviewerAgent(options: ReviewerAgentOptions): ReviewerAgent {
  return new ReviewerAgentImpl(options);
}
