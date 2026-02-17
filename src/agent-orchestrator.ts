/**
 * Agent Orchestrator
 *
 * Monitors tasks in the 'open' state and manages implementor agents.
 * For each open task, an implementor agent is started to work on it.
 * When a task is no longer open, the agent is stopped.
 */

import { TaskManager, type Task } from "dyson-swarm";

export interface AgentInfo {
  taskId: string;
  agentId: string;
  startedAt: Date;
  status: "running" | "stopping" | "stopped";
}

export interface AgentOrchestratorOptions {
  cwdProvider?: () => string;
}

export class AgentOrchestrator {
  private taskManager: TaskManager;
  private runningAgents: Map<string, AgentInfo> = new Map();
  private abortController: AbortController | null = null;

  constructor(options: AgentOrchestratorOptions = {}) {
    this.taskManager = new TaskManager({ cwdProvider: options.cwdProvider });
  }

  async start(): Promise<void> {
    if (this.abortController) {
      console.log("[orchestrator] Already running");
      return;
    }

    this.abortController = new AbortController();
    console.log("[orchestrator] Starting task monitor...");

    try {
      const stream = this.taskManager.listTaskStream({ status: "open" });

      for await (const tasks of stream) {
        if (this.abortController.signal.aborted) {
          break;
        }
        await this.syncAgents(tasks);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("[orchestrator] Task monitor aborted");
      } else {
        console.error("[orchestrator] Error in task monitor:", error);
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.abortController) {
      return;
    }

    console.log("[orchestrator] Stopping task monitor...");
    this.abortController.abort();
    this.abortController = null;

    console.log("[orchestrator] Stopping all running agents...");
    for (const [taskId, agent] of this.runningAgents) {
      await this.stopAgent(taskId);
    }

    this.runningAgents.clear();
    console.log("[orchestrator] Stopped");
  }

  private async syncAgents(openTasks: Task[]): Promise<void> {
    const openTaskIds = new Set(openTasks.map((t) => t.id));

    for (const task of openTasks) {
      if (!this.runningAgents.has(task.id)) {
        await this.startAgent(task.id);
      }
    }

    for (const [taskId, agent] of this.runningAgents) {
      if (!openTaskIds.has(taskId)) {
        console.log(
          `[orchestrator] Task ${taskId} no longer open, stopping agent`
        );
        await this.stopAgent(taskId);
        this.runningAgents.delete(taskId);
      }
    }
  }

  private async startAgent(taskId: string): Promise<void> {
    const agentId = `${taskId}-implementor`;
    console.log(`[orchestrator] Starting implementor agent for task ${taskId}`);

    await this.taskManager.assignTask(taskId, agentId);

    this.runningAgents.set(taskId, {
      taskId,
      agentId,
      startedAt: new Date(),
      status: "running",
    });

    // TODO: Implement actual agent start logic
    // This should spawn an implementor agent to work on the task
    console.log(`[orchestrator] Agent ${agentId} started for task ${taskId} (stub)`);
  }

  private async stopAgent(taskId: string): Promise<void> {
    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      return;
    }

    agent.status = "stopping";
    console.log(`[orchestrator] Stopping agent ${agent.agentId} for task ${taskId}`);

    // TODO: Implement actual agent stop logic
    // This should terminate the implementor agent gracefully
    console.log(`[orchestrator] Agent ${agent.agentId} stopped for task ${taskId} (stub)`);

    await this.taskManager.unassignTask(taskId);

    agent.status = "stopped";
  }

  getRunningAgents(): AgentInfo[] {
    return Array.from(this.runningAgents.values());
  }

  isRunning(): boolean {
    return this.abortController !== null;
  }
}
