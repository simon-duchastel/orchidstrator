/**
 * Task State Machine
 *
 * Encapsulates the state of a task within the orchestrator.
 * Maps dyson-swarm task states to orchid-specific states.
 */

import type { Task as DysonTask } from "dyson-swarm";

/**
 * Internal states for task lifecycle within the orchestrator.
 * These map to the dyson-swarm "in-progress" state but provide more granularity.
 */
export enum TaskState {
  /** Task is waiting to be assigned to an implementor */
  PENDING_IMPLEMENTATION = "pending_implementation",
  /** An implementor agent is actively working on the task */
  IMPLEMENTING = "implementing",
  /** Implementation is complete, waiting for review */
  AWAITING_REVIEW = "awaiting_review",
  /** A reviewer agent is reviewing the implementation */
  REVIEWING = "reviewing",
  /** Review is complete, waiting for merge */
  AWAITING_MERGE = "awaiting_merge",
  /** A merger agent is merging the changes to mainline */
  MERGING = "merging",
  /** Task is complete */
  COMPLETED = "completed",
  /** Task failed during implementation or review */
  FAILED = "failed",
}

export interface TaskStateData {
  taskId: string;
  dysonTask: DysonTask;
  state: TaskState;
  implementorAgentId?: string;
  reviewerAgentId?: string;
  mergerAgentId?: string;
  worktreePath?: string;
  sessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskOptions {
  taskId: string;
  dysonTask: DysonTask;
  worktreePath?: string;
}

/**
 * Task encapsulates the state and lifecycle of a task.
 * Provides a state machine for managing task progression.
 */
export class Task {
  readonly taskId: string;
  readonly dysonTask: DysonTask;
  private _state: TaskState;
  private _implementorAgentId?: string;
  private _reviewerAgentId?: string;
  private _mergerAgentId?: string;
  private _worktreePath?: string;
  private _sessionId?: string;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(options: CreateTaskOptions) {
    this.taskId = options.taskId;
    this.dysonTask = options.dysonTask;
    this._state = TaskState.PENDING_IMPLEMENTATION;
    this._worktreePath = options.worktreePath;
    this.createdAt = new Date();
    this._updatedAt = new Date();
  }

  /**
   * Get current state
   */
  get state(): TaskState {
    return this._state;
  }

  /**
   * Get implementor agent ID
   */
  get implementorAgentId(): string | undefined {
    return this._implementorAgentId;
  }

  /**
   * Get reviewer agent ID
   */
  get reviewerAgentId(): string | undefined {
    return this._reviewerAgentId;
  }

  /**
   * Get merger agent ID
   */
  get mergerAgentId(): string | undefined {
    return this._mergerAgentId;
  }

  /**
   * Get worktree path
   */
  get worktreePath(): string | undefined {
    return this._worktreePath;
  }

  /**
   * Get session ID
   */
  get sessionId(): string | undefined {
    return this._sessionId;
  }

  /**
   * Get last updated timestamp
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Check if task is in a terminal state
   */
  isInTerminalState(): boolean {
    return this._state === TaskState.COMPLETED || this._state === TaskState.FAILED;
  }

  /**
   * Check if task can be assigned an implementor
   */
  canAssignImplementor(): boolean {
    return this._state === TaskState.PENDING_IMPLEMENTATION;
  }

  /**
   * Check if task can be assigned a reviewer
   */
  canAssignReviewer(): boolean {
    return this._state === TaskState.AWAITING_REVIEW;
  }

  /**
   * Transition task to implementing state
   * @param implementorAgentId - The ID of the implementor agent
   * @returns true if transition was successful
   * @throws Error if transition is invalid
   */
  assignImplementor(implementorAgentId: string): void {
    if (!this.canAssignImplementor()) {
      throw new Error(
        `Cannot assign implementor: task is in ${this._state} state, expected PENDING_IMPLEMENTATION`
      );
    }

    this._implementorAgentId = implementorAgentId;
    this._state = TaskState.IMPLEMENTING;
    this._updateTimestamp();
  }

  /**
   * Mark implementation as complete
   * @throws Error if transition is invalid
   */
  markImplementationComplete(): void {
    if (this._state !== TaskState.IMPLEMENTING) {
      throw new Error(
        `Cannot mark implementation complete: task is in ${this._state} state, expected IMPLEMENTING`
      );
    }

    this._state = TaskState.AWAITING_REVIEW;
    this._updateTimestamp();
  }

  /**
   * Assign a reviewer to the task
   * @param reviewerAgentId - The ID of the reviewer agent
   * @throws Error if transition is invalid
   */
  assignReviewer(reviewerAgentId: string): void {
    if (!this.canAssignReviewer()) {
      throw new Error(
        `Cannot assign reviewer: task is in ${this._state} state, expected AWAITING_REVIEW`
      );
    }

    this._reviewerAgentId = reviewerAgentId;
    this._state = TaskState.REVIEWING;
    this._updateTimestamp();
  }

  /**
   * Mark review as complete
   * @throws Error if transition is invalid
   */
  markReviewComplete(): void {
    if (this._state !== TaskState.REVIEWING) {
      throw new Error(
        `Cannot mark review complete: task is in ${this._state} state, expected REVIEWING`
      );
    }

    this._state = TaskState.AWAITING_MERGE;
    this._updateTimestamp();
  }

  /**
   * Check if task can be assigned a merger
   */
  canAssignMerger(): boolean {
    return this._state === TaskState.AWAITING_MERGE;
  }

  /**
   * Assign a merger to the task
   * @param mergerAgentId - The ID of the merger agent
   * @throws Error if transition is invalid
   */
  assignMerger(mergerAgentId: string): void {
    if (!this.canAssignMerger()) {
      throw new Error(
        `Cannot assign merger: task is in ${this._state} state, expected AWAITING_MERGE`
      );
    }

    this._mergerAgentId = mergerAgentId;
    this._state = TaskState.MERGING;
    this._updateTimestamp();
  }

  /**
   * Mark merge as complete
   * @throws Error if transition is invalid
   */
  markMergeComplete(): void {
    if (this._state !== TaskState.MERGING) {
      throw new Error(
        `Cannot mark merge complete: task is in ${this._state} state, expected MERGING`
      );
    }

    this._state = TaskState.COMPLETED;
    this._updateTimestamp();
  }

  /**
   * Mark task as failed
   * @throws Error if transition is invalid (task already in terminal state)
   */
  markFailed(): void {
    if (this.isInTerminalState()) {
      throw new Error(`Cannot mark failed: task is already in terminal state ${this._state}`);
    }

    this._state = TaskState.FAILED;
    this._updateTimestamp();
  }

  /**
   * Set the worktree path
   */
  setWorktreePath(path: string): void {
    this._worktreePath = path;
    this._updateTimestamp();
  }

  /**
   * Set the session ID
   */
  setSessionId(sessionId: string): void {
    this._sessionId = sessionId;
    this._updateTimestamp();
  }

  /**
   * Get serializable state data
   */
  toJSON(): TaskStateData {
    return {
      taskId: this.taskId,
      dysonTask: this.dysonTask,
      state: this._state,
      implementorAgentId: this._implementorAgentId,
      reviewerAgentId: this._reviewerAgentId,
      mergerAgentId: this._mergerAgentId,
      worktreePath: this._worktreePath,
      sessionId: this._sessionId,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }

  private _updateTimestamp(): void {
    this._updatedAt = new Date();
  }
}

/**
 * Factory function to create a Task from dyson-swarm data
 */
export function createTaskFromDyson(dysonTask: DysonTask, worktreesDir: string): Task {
  return new Task({
    taskId: dysonTask.id,
    dysonTask,
    worktreePath: `${worktreesDir}/${dysonTask.id}`,
  });
}
