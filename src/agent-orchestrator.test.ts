import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentOrchestrator } from "./agent-orchestrator";

const mocks = vi.hoisted(() => {
  const mockListTaskStream = vi.fn();
  const mockAssignTask = vi.fn();
  const mockUnassignTask = vi.fn();
  
  class MockTaskManager {
    listTaskStream = mockListTaskStream;
    assignTask = mockAssignTask;
    unassignTask = mockUnassignTask;
  }
  
  return {
    mockListTaskStream,
    mockAssignTask,
    mockUnassignTask,
    MockTaskManager,
  };
});

vi.mock("dyson-swarm", () => ({
  TaskManager: mocks.MockTaskManager,
}));

describe("AgentOrchestrator", () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    orchestrator = new AgentOrchestrator();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("start", () => {
    it("should start monitoring tasks", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      const startPromise = orchestrator.start();

      await vi.runAllTimersAsync();
      await startPromise;

      expect(mocks.mockListTaskStream).toHaveBeenCalledWith({ status: "open" });
    });

    it("should not start if already running", async () => {
      const streamIterator = (async function* () {
        yield [];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();

      await vi.runAllTimersAsync();

      orchestrator.start();

      expect(mocks.mockListTaskStream).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should stop the orchestrator", async () => {
      const streamIterator = (async function* () {
        yield [];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      await orchestrator.stop();

      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should stop all running agents", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(orchestrator.getRunningAgents()).toHaveLength(1);

      await orchestrator.stop();

      expect(orchestrator.getRunningAgents()).toHaveLength(0);
      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-1");
    });
  });

  describe("agent lifecycle", () => {
    it("should start an agent for a new open task", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
      expect(orchestrator.getRunningAgents()[0]).toMatchObject({
        taskId: "task-1",
        agentId: "task-1-implementor",
        status: "running",
      });
    });

    it("should not start duplicate agents for the same task", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);

      const task = { id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" };
      const streamIterator = (async function* () {
        yield [task];
        yield [task];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledTimes(1);
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
    });

    it("should stop an agent when task is no longer open", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);

      const streamIterator = (async function* () {
        yield [{ id: "task-1", frontmatter: { title: "Test" }, description: "", status: "open" }];
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-1");
      expect(orchestrator.getRunningAgents()).toHaveLength(0);
    });

    it("should handle multiple tasks", async () => {
      mocks.mockAssignTask.mockResolvedValue(undefined);
      mocks.mockUnassignTask.mockResolvedValue(undefined);

      const streamIterator = (async function* () {
        yield [
          { id: "task-1", frontmatter: { title: "Test 1" }, description: "", status: "open" },
          { id: "task-2", frontmatter: { title: "Test 2" }, description: "", status: "open" },
        ];
        yield [{ id: "task-1", frontmatter: { title: "Test 1" }, description: "", status: "open" }];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-1", "task-1-implementor");
      expect(mocks.mockAssignTask).toHaveBeenCalledWith("task-2", "task-2-implementor");
      expect(mocks.mockUnassignTask).toHaveBeenCalledWith("task-2");
      expect(orchestrator.getRunningAgents()).toHaveLength(1);
    });
  });

  describe("getRunningAgents", () => {
    it("should return empty array when no agents running", () => {
      expect(orchestrator.getRunningAgents()).toEqual([]);
    });
  });

  describe("isRunning", () => {
    it("should return false when not started", () => {
      expect(orchestrator.isRunning()).toBe(false);
    });

    it("should return true when started", async () => {
      const streamIterator = (async function* () {
        yield [];
      })();
      mocks.mockListTaskStream.mockReturnValue(streamIterator);

      orchestrator.start();
      await vi.runAllTimersAsync();

      expect(orchestrator.isRunning()).toBe(true);
    });
  });
});
