/**
 * Agent Orchestrator
 *
 * Monitors tasks and orchestrates agent lifecycles.
 * Uses Task state machine and separate agent implementations.
 * Responsibilities:
 * - Detect when new implementors/reviewers are needed
 * - Create and attach agents
 * - Handle agent lifecycle events
 * - Move tasks through the state machine
 */

import { TaskManager, type Task as DysonTask } from "dyson-swarm";
import { WorktreeManager } from "../../git/worktrees/index.js";
import { getWorktreesDir } from "../../config/paths.js";
import { OpencodeSessionManager, type AgentSession } from "../session/index.js";
import { Task, TaskState, createTaskFromDyson } from "../../tasks/index.js";
import { createImplementorAgent, type ImplementorAgent } from "../agents/implementor/index.js";
import { createReviewerAgent, type ReviewerAgent } from "../agents/reviewer/index.js";
import { createMergerAgent, type MergerAgent } from "../agents/merger/index.js";
import { log } from "../../core/logging/index.js";
import type { GlobalEvent, EventSessionIdle } from "@opencode-ai/sdk";

export interface AgentInfo {
  taskId: string;
  agentId: string;
  startedAt: Date;
  state: TaskState;
  worktreePath: string;
  sessionId?: string;
}

export interface AgentOrchestratorOptions {
  cwdProvider?: () => string;
  worktreeManager?: WorktreeManager;
  sessionManager?: OpencodeSessionManager;
  opencodeBaseUrl: string;
}

export class AgentOrchestrator {
  private taskManager: TaskManager;
  private tasks: Map<string, Task> = new Map();
  private implementors: Map<string, ImplementorAgent> = new Map();
  private reviewers: Map<string, ReviewerAgent> = new Map();
  private mergers: Map<string, MergerAgent> = new Map();
  private abortController: AbortController | null = null;
  private worktreeManager: WorktreeManager;
  private sessionManager: OpencodeSessionManager;
  private cwdProvider: () => string;
  private worktreesDir: string;
  private eventStreamAbortController: AbortController | null = null;

  constructor(options: AgentOrchestratorOptions) {
    this.cwdProvider = options.cwdProvider ?? (() => process.cwd());
    this.taskManager = new TaskManager({ cwdProvider: this.cwdProvider });
    this.worktreeManager = options.worktreeManager ?? new WorktreeManager(this.cwdProvider());
    
    // Initialize session manager with the worktrees directory
    this.worktreesDir = getWorktreesDir(this.cwdProvider);
    this.sessionManager = options.sessionManager ?? new OpencodeSessionManager({
      sessionsDir: this.worktreesDir,
      baseUrl: options.opencodeBaseUrl,
    });
  }

  async start(): Promise<void> {
    if (this.abortController) {
      log.log("[orchestrator] Already running");
      return;
    }

    this.abortController = new AbortController();
    log.log("[orchestrator] Starting task monitor...");

    // Start listening for OpenCode events (including session.idle)
    this.startEventListener();

    try {
      const stream = this.taskManager.listTaskStream({ status: "open" });

      for await (const dysonTasks of stream) {
        if (this.abortController.signal.aborted) {
          break;
        }
        await this.syncTasks(dysonTasks);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        log.log("[orchestrator] Task monitor aborted");
      } else {
        log.error("[orchestrator] Error in task monitor:", error);
      }
    }
  }

  /**
   * Start listening to OpenCode global events for session idle notifications.
   */
  private async startEventListener(): Promise<void> {
    if (this.eventStreamAbortController) {
      return;
    }

    this.eventStreamAbortController = new AbortController();
    const client = this.sessionManager.getClient();

    try {
      log.log("[orchestrator] Starting OpenCode event listener...");
      
      const result = await client.global.event();
      
      for await (const event of result.stream) {
        if (this.eventStreamAbortController.signal.aborted) {
          break;
        }

        await this.handleEvent(event as GlobalEvent);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        log.log("[orchestrator] Event listener aborted");
      } else {
        log.error("[orchestrator] Error in event listener:", error);
      }
    }
  }

  /**
   * Handle an OpenCode event.
   * Currently only handles session.idle events.
   */
  private async handleEvent(event: GlobalEvent): Promise<void> {
    if (!event.payload) {
      return;
    }

    if (event.payload.type === "session.idle") {
      const idleEvent = event.payload as EventSessionIdle;
      const sessionId = idleEvent.properties.sessionID;
      
      log.log(`[orchestrator] Session ${sessionId} became idle`);
      
      // Find task by session ID and route to appropriate handler based on task state
      const task = this.findTaskBySessionId(sessionId);
      if (task) {
        await this.handleSessionIdleForTask(task);
      }
    }
  }

  /**
   * Handle session idle for a task based on its current state.
   * Routes to the appropriate completion handler.
   */
  private async handleSessionIdleForTask(task: Task): Promise<void> {
    switch (task.state) {
      case TaskState.IMPLEMENTING:
        await this.handleImplementationComplete(task.taskId);
        break;
      case TaskState.REVIEWING:
        await this.handleReviewComplete(task.taskId);
        break;
      case TaskState.MERGING:
        await this.handleMergeComplete(task.taskId);
        break;
      default:
        log.log(`[orchestrator] Session idle for task ${task.taskId} in state ${task.state}, no action needed`);
    }
  }

  /**
   * Find a task by its session ID.
   */
  private findTaskBySessionId(sessionId: string): Task | undefined {
    for (const task of this.tasks.values()) {
      if (task.sessionId === sessionId) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Handle implementation completion.
   * Called when an implementor agent finishes.
   * Creates a reviewer agent for the task.
   */
  private async handleImplementationComplete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for completion`);
      return;
    }

    log.log(`[orchestrator] Task ${taskId} implementation complete`);

    // Remove the implementor agent
    const implementor = this.implementors.get(taskId);
    if (implementor) {
      await implementor.stop();
      this.implementors.delete(taskId);
    }

    // Transition task state
    try {
      task.markImplementationComplete();
      log.log(`[orchestrator] Task ${taskId} moved to AWAITING_REVIEW state`);
      
      // Create reviewer agent
      await this.createReviewer(task);
    } catch (error) {
      log.error(`[orchestrator] Failed to transition task ${taskId}:`, error);
    }
  }

  /**
   * Handle review completion.
   * Called when a reviewer agent finishes.
   * Creates a merger agent for the task.
   */
  private async handleReviewComplete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for review completion`);
      return;
    }

    log.log(`[orchestrator] Task ${taskId} review complete`);

    // Remove the reviewer agent
    const reviewer = this.reviewers.get(taskId);
    if (reviewer) {
      await reviewer.stop();
      this.reviewers.delete(taskId);
    }

    // Transition task state
    try {
      task.markReviewComplete();
      log.log(`[orchestrator] Task ${taskId} moved to AWAITING_MERGE state`);
      
      // Create merger agent
      await this.createMerger(task);
    } catch (error) {
      log.error(`[orchestrator] Failed to transition task ${taskId} after review:`, error);
    }
  }

  /**
   * Handle merge completion.
   * Called when a merger agent finishes.
   * Cleans up resources and marks task as complete.
   */
  private async handleMergeComplete(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for merge completion`);
      return;
    }

    log.log(`[orchestrator] Task ${taskId} merge complete`);

    // Remove the merger agent
    const merger = this.mergers.get(taskId);
    if (merger) {
      await merger.stop();
      this.mergers.delete(taskId);
    }

    // Transition task state
    try {
      task.markMergeComplete();
      log.log(`[orchestrator] Task ${taskId} moved to COMPLETED state`);
      
      // Clean up resources
      await this.cleanupTaskResources(taskId);
      
      // Remove task from tracking
      this.tasks.delete(taskId);
      log.log(`[orchestrator] Task ${taskId} completed and cleaned up`);
    } catch (error) {
      log.error(`[orchestrator] Failed to transition task ${taskId} after merge:`, error);
    }
  }

  /**
   * Handle implementation error.
   * Called when an implementor agent fails.
   * Cleans up worktree and session.
   */
  private async handleImplementationError(taskId: string, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for error handling`);
      return;
    }

    log.error(`[orchestrator] Task ${taskId} implementation failed:`, error);

    // Remove the implementor agent
    const implementor = this.implementors.get(taskId);
    if (implementor) {
      this.implementors.delete(taskId);
    }

    // Clean up session and worktree
    await this.cleanupTaskResources(taskId);

    // Mark task as failed
    try {
      task.markFailed();
      log.log(`[orchestrator] Task ${taskId} moved to FAILED state`);
    } catch (err) {
      log.error(`[orchestrator] Failed to mark task ${taskId} as failed:`, err);
    }
  }

  /**
   * Clean up resources for a task.
   */
  private async cleanupTaskResources(taskId: string): Promise<void> {
    // Remove session
    try {
      await this.sessionManager.removeSession(taskId);
      log.log(`[orchestrator] Removed session for task ${taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to remove session for task ${taskId}:`, error);
    }

    // Remove worktree
    const worktreePath = `${this.worktreesDir}/${taskId}`;
    try {
      await this.worktreeManager.remove(worktreePath, { force: true });
      log.log(`[orchestrator] Removed worktree for task ${taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to remove worktree for task ${taskId}:`, error);
    }
  }

  async stop(): Promise<void> {
    if (!this.abortController) {
      return;
    }

    log.log("[orchestrator] Stopping...");
    this.abortController.abort();
    this.abortController = null;

    // Stop event listener
    if (this.eventStreamAbortController) {
      this.eventStreamAbortController.abort();
      this.eventStreamAbortController = null;
      log.log("[orchestrator] Event listener stopped");
    }

    // Stop all implementor agents
    log.log("[orchestrator] Stopping all implementor agents...");
    for (const [taskId, implementor] of this.implementors) {
      try {
        await implementor.stop();
        log.log(`[orchestrator] Stopped implementor for task ${taskId}`);
      } catch (error) {
        log.error(`[orchestrator] Error stopping implementor for task ${taskId}:`, error);
      }
    }
    this.implementors.clear();

    // Stop all reviewer agents
    log.log("[orchestrator] Stopping all reviewer agents...");
    for (const [taskId, reviewer] of this.reviewers) {
      try {
        await reviewer.stop();
        log.log(`[orchestrator] Stopped reviewer for task ${taskId}`);
      } catch (error) {
        log.error(`[orchestrator] Error stopping reviewer for task ${taskId}:`, error);
      }
    }
    this.reviewers.clear();

    // Stop all merger agents
    log.log("[orchestrator] Stopping all merger agents...");
    for (const [taskId, merger] of this.mergers) {
      try {
        await merger.stop();
        log.log(`[orchestrator] Stopped merger for task ${taskId}`);
      } catch (error) {
        log.error(`[orchestrator] Error stopping merger for task ${taskId}:`, error);
      }
    }
    this.mergers.clear();

    // Clear tasks
    this.tasks.clear();
    
    // Stop all sessions
    try {
      await this.sessionManager.stopAllSessions();
      log.log("[orchestrator] All OpenCode sessions stopped");
    } catch (error) {
      log.error("[orchestrator] Error stopping sessions:", error);
    }
    
    log.log("[orchestrator] Stopped");
  }

  /**
   * Sync tasks with dyson-swarm.
   * Creates tasks for new open tasks, removes tasks that are no longer open.
   */
  private async syncTasks(dysonTasks: DysonTask[]): Promise<void> {
    const openTaskIds = new Set(dysonTasks.map((t) => t.id));

    // Create tasks for new open tasks
    for (const dysonTask of dysonTasks) {
      if (!this.tasks.has(dysonTask.id)) {
        const task = createTaskFromDyson(dysonTask, this.worktreesDir);
        this.tasks.set(task.taskId, task);
        log.log(`[orchestrator] Created task ${task.taskId}`);
      }
    }

    // Remove tasks that are no longer open
    for (const [taskId, task] of this.tasks) {
      if (!openTaskIds.has(taskId)) {
        // Task is no longer open
        log.log(`[orchestrator] Task ${taskId} no longer open, cleaning up`);
        
        // Stop implementor if running
        const implementor = this.implementors.get(taskId);
        if (implementor) {
          await implementor.stop();
          this.implementors.delete(taskId);
        }
        
        // Stop reviewer if running
        const reviewer = this.reviewers.get(taskId);
        if (reviewer) {
          await reviewer.stop();
          this.reviewers.delete(taskId);
        }
        
        // Stop merger if running
        const merger = this.mergers.get(taskId);
        if (merger) {
          await merger.stop();
          this.mergers.delete(taskId);
        }
        
        // Clean up session and worktree
        await this.cleanupTaskResources(taskId);
        
        this.tasks.delete(taskId);
      }
    }

    // Process tasks - assign implementors where needed
    await this.processTasks();
  }

  /**
   * Process tasks in the state machine.
   * Assigns agents based on task state.
   */
  private async processTasks(): Promise<void> {
    for (const task of this.tasks.values()) {
      // Check if task needs an implementor
      if (task.canAssignImplementor() && !this.implementors.has(task.taskId)) {
        await this.createImplementor(task);
      }

      // Check if task needs a reviewer
      if (task.canAssignReviewer() && !this.reviewers.has(task.taskId)) {
        await this.createReviewer(task);
      }

      // Check if task needs a merger
      if (task.canAssignMerger() && !this.mergers.has(task.taskId)) {
        await this.createMerger(task);
      }
    }
  }

  /**
   * Create an implementor agent for a task.
   * Creates worktree and session first, then assigns the implementor agent.
   */
  private async createImplementor(task: Task): Promise<void> {
    const agentId = `${task.taskId}-implementor`;
    log.log(`[orchestrator] Creating implementor ${agentId} for task ${task.taskId}`);

    try {
      // Transition task state first to mark it as taken
      task.assignImplementor(agentId);

      // Create worktree
      const worktreePath = `${this.worktreesDir}/${task.taskId}`;
      await this.worktreeManager.create(worktreePath, "HEAD", { detach: true });
      log.log(`[orchestrator] Created worktree at ${worktreePath} for task ${task.taskId}`);

      // Create session
      const session = await this.sessionManager.createSession(task.taskId);
      log.log(`[orchestrator] Created session ${session.sessionId} for task ${task.taskId}`);
      task.setSessionId(session.sessionId);

      // Create implementor agent
      const implementor = createImplementorAgent({
        taskId: task.taskId,
        dysonTask: task.dysonTask,
        worktreePath: worktreePath,
        session: session,
        sessionManager: this.sessionManager,
        taskManager: this.taskManager,
        onComplete: (taskId: string, session: AgentSession) => {
          // This will be called via session idle event
          log.log(`[orchestrator] Implementor ${agentId} completed for task ${taskId}`);
        },
        onError: (taskId: string, error: Error) => {
          this.handleImplementationError(taskId, error);
        },
      });

      this.implementors.set(task.taskId, implementor);

      // Start the implementor
      await implementor.start();

      log.log(`[orchestrator] Implementor ${agentId} started for task ${task.taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create implementor for task ${task.taskId}:`, error);
      await this.handleImplementationError(task.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create a reviewer agent for a task.
   * Uses existing worktree and session from the implementor.
   */
  private async createReviewer(task: Task): Promise<void> {
    const agentId = `${task.taskId}-reviewer`;
    log.log(`[orchestrator] Creating reviewer ${agentId} for task ${task.taskId}`);

    try {
      // Transition task state
      task.assignReviewer(agentId);

      // Get existing worktree and session from the task
      const worktreePath = task.worktreePath;
      
      if (!worktreePath) {
        throw new Error(`Task ${task.taskId} missing worktree for review`);
      }

      // Get the existing session using taskId (sessionManager uses taskId as key)
      const session = await this.sessionManager.getSession(task.taskId);
      if (!session) {
        throw new Error(`Session not found for task ${task.taskId}`);
      }

      log.log(`[orchestrator] Using existing worktree at ${worktreePath} and session ${session.sessionId}`);

      // Create reviewer agent
      const reviewer = createReviewerAgent({
        taskId: task.taskId,
        dysonTask: task.dysonTask,
        worktreePath: worktreePath,
        session: session,
        sessionManager: this.sessionManager,
        onComplete: (taskId: string, _session: AgentSession) => {
          // This will be called via session idle event
          log.log(`[orchestrator] Reviewer ${agentId} completed for task ${taskId}`);
        },
        onError: (taskId: string, error: Error) => {
          this.handleReviewError(taskId, error);
        },
      });

      this.reviewers.set(task.taskId, reviewer);

      // Start the reviewer
      await reviewer.start();

      log.log(`[orchestrator] Reviewer ${agentId} started for task ${task.taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create reviewer for task ${task.taskId}:`, error);
      await this.handleReviewError(task.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create a merger agent for a task.
   * Uses existing worktree and session.
   */
  private async createMerger(task: Task): Promise<void> {
    const agentId = `${task.taskId}-merger`;
    log.log(`[orchestrator] Creating merger ${agentId} for task ${task.taskId}`);

    try {
      // Transition task state
      task.assignMerger(agentId);

      // Get existing worktree and session from the task
      const worktreePath = task.worktreePath;
      
      if (!worktreePath) {
        throw new Error(`Task ${task.taskId} missing worktree for merge`);
      }

      // Get the existing session using taskId (sessionManager uses taskId as key)
      const session = await this.sessionManager.getSession(task.taskId);
      if (!session) {
        throw new Error(`Session not found for task ${task.taskId}`);
      }

      log.log(`[orchestrator] Using existing worktree at ${worktreePath} and session ${session.sessionId}`);

      // Create merger agent
      const merger = createMergerAgent({
        taskId: task.taskId,
        worktreePath: worktreePath,
        session: session,
        sessionManager: this.sessionManager,
        onComplete: (taskId: string, _session: AgentSession) => {
          // This will be called via session idle event
          log.log(`[orchestrator] Merger ${agentId} completed for task ${taskId}`);
        },
        onError: (taskId: string, error: Error) => {
          this.handleMergeError(taskId, error);
        },
      });

      this.mergers.set(task.taskId, merger);

      // Start the merger
      await merger.start();

      log.log(`[orchestrator] Merger ${agentId} started for task ${task.taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create merger for task ${task.taskId}:`, error);
      await this.handleMergeError(task.taskId, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle review error.
   * Called when a reviewer agent fails.
   */
  private async handleReviewError(taskId: string, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for review error handling`);
      return;
    }

    log.error(`[orchestrator] Task ${taskId} review failed:`, error);

    // Remove the reviewer agent
    const reviewer = this.reviewers.get(taskId);
    if (reviewer) {
      this.reviewers.delete(taskId);
    }

    // Clean up session and worktree
    await this.cleanupTaskResources(taskId);

    // Mark task as failed
    try {
      task.markFailed();
      log.log(`[orchestrator] Task ${taskId} moved to FAILED state`);
    } catch (err) {
      log.error(`[orchestrator] Failed to mark task ${taskId} as failed:`, err);
    }
  }

  /**
   * Handle merge error.
   * Called when a merger agent fails.
   */
  private async handleMergeError(taskId: string, error: Error): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      log.error(`[orchestrator] Task ${taskId} not found for merge error handling`);
      return;
    }

    log.error(`[orchestrator] Task ${taskId} merge failed:`, error);

    // Remove the merger agent
    const merger = this.mergers.get(taskId);
    if (merger) {
      this.mergers.delete(taskId);
    }

    // Clean up session and worktree
    await this.cleanupTaskResources(taskId);

    // Mark task as failed
    try {
      task.markFailed();
      log.log(`[orchestrator] Task ${taskId} moved to FAILED state`);
    } catch (err) {
      log.error(`[orchestrator] Failed to mark task ${taskId} as failed:`, err);
    }
  }

  /**
   * Get running agents info.
   */
  getRunningAgents(): AgentInfo[] {
    const agents: AgentInfo[] = [];
    
    for (const task of this.tasks.values()) {
      const worktreePath = task.worktreePath || `${this.worktreesDir}/${task.taskId}`;
      const baseInfo = {
        taskId: task.taskId,
        startedAt: task.createdAt,
        state: task.state,
        worktreePath,
        sessionId: task.sessionId,
      };
      
      // Add implementor if present
      if (task.implementorAgentId) {
        agents.push({
          ...baseInfo,
          agentId: task.implementorAgentId,
        });
      }
      
      // Add reviewer if present
      if (task.reviewerAgentId) {
        agents.push({
          ...baseInfo,
          agentId: task.reviewerAgentId,
        });
      }
      
      // Add merger if present
      if (task.mergerAgentId) {
        agents.push({
          ...baseInfo,
          agentId: task.mergerAgentId,
        });
      }
    }
    
    return agents;
  }

  /**
   * Check if orchestrator is running.
   */
  isRunning(): boolean {
    return this.abortController !== null;
  }
}
