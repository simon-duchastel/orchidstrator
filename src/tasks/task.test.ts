import { describe, it, expect, beforeEach } from "vitest";
import { Task, TaskState, createTaskFromDyson } from "./index.js";
import type { Task as DysonTask } from "dyson-swarm";

const createMockDysonTask = (overrides: Partial<DysonTask> = {}): DysonTask => ({
  id: "test-task-123",
  frontmatter: {
    title: "Test Task",
  },
  description: "Test task description",
  status: "open",
  ...overrides,
});

describe("Task", () => {
  let task: Task;
  let mockDysonTask: DysonTask;

  beforeEach(() => {
    mockDysonTask = createMockDysonTask();
    task = new Task({
      taskId: mockDysonTask.id,
      dysonTask: mockDysonTask,
      worktreePath: "/test/worktrees/test-task-123",
    });
  });

  describe("construction", () => {
    it("should create a task with initial state PENDING_IMPLEMENTATION", () => {
      expect(task.state).toBe(TaskState.PENDING_IMPLEMENTATION);
    });

    it("should store taskId and dysonTask", () => {
      expect(task.taskId).toBe("test-task-123");
      expect(task.dysonTask).toBe(mockDysonTask);
    });

    it("should store worktreePath", () => {
      expect(task.worktreePath).toBe("/test/worktrees/test-task-123");
    });

    it("should set createdAt timestamp", () => {
      expect(task.createdAt).toBeInstanceOf(Date);
    });

    it("should set updatedAt timestamp", () => {
      expect(task.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("state queries", () => {
    it("isInTerminalState should return false for PENDING_IMPLEMENTATION", () => {
      expect(task.isInTerminalState()).toBe(false);
    });

    it("isInTerminalState should return false for IMPLEMENTING", () => {
      task.assignImplementor("agent-1");
      expect(task.isInTerminalState()).toBe(false);
    });

    it("isInTerminalState should return false for AWAITING_REVIEW", () => {
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      expect(task.isInTerminalState()).toBe(false);
    });

    it("isInTerminalState should return false for REVIEWING", () => {
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      task.assignReviewer("reviewer-1");
      expect(task.isInTerminalState()).toBe(false);
    });

    it("isInTerminalState should return false for AWAITING_MERGE", () => {
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      task.assignReviewer("reviewer-1");
      task.markReviewComplete();
      expect(task.isInTerminalState()).toBe(false);
    });

    it("isInTerminalState should return false for MERGING", () => {
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      task.assignReviewer("reviewer-1");
      task.markReviewComplete();
      task.assignMerger("merger-1");
      expect(task.isInTerminalState()).toBe(false);
    });

    it("isInTerminalState should return true for COMPLETED", () => {
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      task.assignReviewer("reviewer-1");
      task.markReviewComplete();
      task.assignMerger("merger-1");
      task.markMergeComplete();
      expect(task.isInTerminalState()).toBe(true);
    });

    it("isInTerminalState should return true for FAILED", () => {
      task.assignImplementor("agent-1");
      task.markFailed();
      expect(task.isInTerminalState()).toBe(true);
    });

    it("canAssignImplementor should return true for PENDING_IMPLEMENTATION", () => {
      expect(task.canAssignImplementor()).toBe(true);
    });

    it("canAssignImplementor should return false for other states", () => {
      task.assignImplementor("agent-1");
      expect(task.canAssignImplementor()).toBe(false);
    });

    it("canAssignReviewer should return true for AWAITING_REVIEW", () => {
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      expect(task.canAssignReviewer()).toBe(true);
    });

    it("canAssignReviewer should return false for other states", () => {
      expect(task.canAssignReviewer()).toBe(false);
      task.assignImplementor("agent-1");
      expect(task.canAssignReviewer()).toBe(false);
    });

    it("canAssignMerger should return true for AWAITING_MERGE", () => {
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      task.assignReviewer("reviewer-1");
      task.markReviewComplete();
      expect(task.canAssignMerger()).toBe(true);
    });

    it("canAssignMerger should return false for other states", () => {
      expect(task.canAssignMerger()).toBe(false);
      task.assignImplementor("agent-1");
      task.markImplementationComplete();
      expect(task.canAssignMerger()).toBe(false);
    });
  });

  describe("state transitions", () => {
    describe("assignImplementor", () => {
      it("should transition from PENDING_IMPLEMENTATION to IMPLEMENTING", () => {
        task.assignImplementor("implementor-1");
        expect(task.state).toBe(TaskState.IMPLEMENTING);
        expect(task.implementorAgentId).toBe("implementor-1");
      });

      it("should throw error when not in PENDING_IMPLEMENTATION state", () => {
        task.assignImplementor("implementor-1");
        expect(() => task.assignImplementor("implementor-2")).toThrow(
          "Cannot assign implementor: task is in implementing state"
        );
      });

      it("should update timestamp", () => {
        const before = task.updatedAt;
        task.assignImplementor("implementor-1");
        expect(task.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      });
    });

    describe("markImplementationComplete", () => {
      it("should transition from IMPLEMENTING to AWAITING_REVIEW", () => {
        task.assignImplementor("implementor-1");
        task.markImplementationComplete();
        expect(task.state).toBe(TaskState.AWAITING_REVIEW);
      });

      it("should throw error when not in IMPLEMENTING state", () => {
        expect(() => task.markImplementationComplete()).toThrow(
          "Cannot mark implementation complete: task is in pending_implementation state"
        );
      });
    });

    describe("assignReviewer", () => {
      it("should transition from AWAITING_REVIEW to REVIEWING", () => {
        task.assignImplementor("implementor-1");
        task.markImplementationComplete();
        task.assignReviewer("reviewer-1");
        expect(task.state).toBe(TaskState.REVIEWING);
        expect(task.reviewerAgentId).toBe("reviewer-1");
      });

      it("should throw error when not in AWAITING_REVIEW state", () => {
        expect(() => task.assignReviewer("reviewer-1")).toThrow(
          "Cannot assign reviewer: task is in pending_implementation state"
        );
      });
    });

    describe("markReviewComplete", () => {
      it("should transition from REVIEWING to AWAITING_MERGE", () => {
        task.assignImplementor("implementor-1");
        task.markImplementationComplete();
        task.assignReviewer("reviewer-1");
        task.markReviewComplete();
        expect(task.state).toBe(TaskState.AWAITING_MERGE);
      });

      it("should throw error when not in REVIEWING state", () => {
        expect(() => task.markReviewComplete()).toThrow(
          "Cannot mark review complete: task is in pending_implementation state"
        );
      });
    });

    describe("assignMerger", () => {
      it("should transition from AWAITING_MERGE to MERGING", () => {
        task.assignImplementor("implementor-1");
        task.markImplementationComplete();
        task.assignReviewer("reviewer-1");
        task.markReviewComplete();
        task.assignMerger("merger-1");
        expect(task.state).toBe(TaskState.MERGING);
        expect(task.mergerAgentId).toBe("merger-1");
      });

      it("should throw error when not in AWAITING_MERGE state", () => {
        expect(() => task.assignMerger("merger-1")).toThrow(
          "Cannot assign merger: task is in pending_implementation state"
        );
      });
    });

    describe("markMergeComplete", () => {
      it("should transition from MERGING to COMPLETED", () => {
        task.assignImplementor("implementor-1");
        task.markImplementationComplete();
        task.assignReviewer("reviewer-1");
        task.markReviewComplete();
        task.assignMerger("merger-1");
        task.markMergeComplete();
        expect(task.state).toBe(TaskState.COMPLETED);
      });

      it("should throw error when not in MERGING state", () => {
        expect(() => task.markMergeComplete()).toThrow(
          "Cannot mark merge complete: task is in pending_implementation state"
        );
      });
    });

    describe("markFailed", () => {
      it("should transition from PENDING_IMPLEMENTATION to FAILED", () => {
        task.markFailed();
        expect(task.state).toBe(TaskState.FAILED);
      });

      it("should transition from IMPLEMENTING to FAILED", () => {
        task.assignImplementor("implementor-1");
        task.markFailed();
        expect(task.state).toBe(TaskState.FAILED);
      });

      it("should throw error when already in terminal state", () => {
        task.markFailed();
        expect(() => task.markFailed()).toThrow(
          "Cannot mark failed: task is already in terminal state failed"
        );
      });

      it("should throw error when in COMPLETED state", () => {
        task.assignImplementor("implementor-1");
        task.markImplementationComplete();
        task.assignReviewer("reviewer-1");
        task.markReviewComplete();
        task.assignMerger("merger-1");
        task.markMergeComplete();
        expect(() => task.markFailed()).toThrow(
          "Cannot mark failed: task is already in terminal state completed"
        );
      });
    });
  });
});

describe("createTaskFromDyson", () => {
  it("should create a Task from dyson task data", () => {
    const dysonTask = createMockDysonTask({ id: "task-abc" });
    const task = createTaskFromDyson(dysonTask, "/test/worktrees");
    
    expect(task.taskId).toBe("task-abc");
    expect(task.dysonTask).toBe(dysonTask);
    expect(task.worktreePath).toBe("/test/worktrees/task-abc");
    expect(task.state).toBe(TaskState.PENDING_IMPLEMENTATION);
  });
});
