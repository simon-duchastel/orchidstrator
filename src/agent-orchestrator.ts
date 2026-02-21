/**
 * Agent Orchestrator
 *
 * Monitors tasks in the 'open' state and manages implementor agents.
 * For each open task, an implementor agent is started to work on it.
 * When a task is no longer open, the agent is stopped.
 * Each agent gets its own worktree in the worktrees/ directory named by task ID.
 */

import { TaskManager, type Task } from "dyson-swarm";
import { join } from "node:path";
import { WorktreeManager } from "./worktrees/index.js";
import { getWorktreesDir } from "./paths.js";
import {
  OpencodeSessionManager,
  type AgentSession,
} from "./opencode-session.js";
import { fillAgentPromptTemplate } from "./templates.js";
import { log } from "./utils/logger.js";
import { ReviewAgent } from "./review-agent.js";

export interface AgentInfo {
  taskId: string;
  agentId: string;
  startedAt: Date;
  status: "running" | "stopping" | "stopped";
  worktreePath: string;
  session?: AgentSession;
}

export interface AgentOrchestratorOptions {
  cwdProvider?: () => string;
  worktreeManager?: WorktreeManager;
  sessionManager?: OpencodeSessionManager;
  opencodeBaseUrl: string;
  reviewAgent?: ReviewAgent;
}

export class AgentOrchestrator {
  private taskManager: TaskManager;
  private runningAgents: Map<string, AgentInfo> = new Map();
  private abortController: AbortController | null = null;
  private worktreeManager: WorktreeManager;
  private sessionManager: OpencodeSessionManager;
  private cwdProvider: () => string;
  private reviewAgent: ReviewAgent;

  constructor(options: AgentOrchestratorOptions) {
    this.cwdProvider = options.cwdProvider ?? (() => process.cwd());
    this.taskManager = new TaskManager({ cwdProvider: this.cwdProvider });
    this.worktreeManager = options.worktreeManager ?? new WorktreeManager(this.cwdProvider());
    
    // Initialize session manager with the worktrees directory
    const worktreesDir = getWorktreesDir(this.cwdProvider);
    this.sessionManager = options.sessionManager ?? new OpencodeSessionManager({
      sessionsDir: worktreesDir,
      baseUrl: options.opencodeBaseUrl,
    });

    // Initialize review agent for monitoring idle sessions
    this.reviewAgent = options.reviewAgent ?? new ReviewAgent({
      sessionManager: this.sessionManager,
    });
  }

  async start(): Promise<void> {
    if (this.abortController) {
      log.log("[orchestrator] Already running");
      return;
    }

    this.abortController = new AbortController();
    log.log("[orchestrator] Starting task monitor...");

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
        log.log("[orchestrator] Task monitor aborted");
      } else {
        log.error("[orchestrator] Error in task monitor:", error);
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.abortController) {
      return;
    }

    log.log("[orchestrator] Stopping task monitor...");
    this.abortController.abort();
    this.abortController = null;

    log.log("[orchestrator] Stopping all running agents...");
    for (const [taskId, agent] of this.runningAgents) {
      await this.stopAgent(taskId);
    }

    this.runningAgents.clear();
    
    // Stop all review agent monitoring
    try {
      this.reviewAgent.stopAllMonitoring();
      log.log("[orchestrator] All review agent monitoring stopped");
    } catch (error) {
      log.error("[orchestrator] Error stopping review agent monitoring:", error);
    }
    
    // Stop all remaining sessions (in case any weren't cleaned up)
    try {
      await this.sessionManager.stopAllSessions();
      log.log("[orchestrator] All OpenCode sessions stopped");
    } catch (error) {
      log.error("[orchestrator] Error stopping sessions:", error);
    }
    
    log.log("[orchestrator] Stopped");
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
        log.log(
          `[orchestrator] Task ${taskId} no longer open, stopping agent`
        );
        await this.stopAgent(taskId);
        this.runningAgents.delete(taskId);
      }
    }
  }

  private async startAgent(taskId: string): Promise<void> {
    const agentId = `${taskId}-implementor`;
    log.log(`[orchestrator] Starting implementor agent for task ${taskId}`);

    // Get task details
    const tasks = await this.taskManager.listTasks({ status: "open" });
    const task = tasks.find((t: Task) => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const worktreesDir = getWorktreesDir(this.cwdProvider);
    const worktreePath = join(worktreesDir, taskId);

    try {
      await this.worktreeManager.create(worktreePath, "HEAD", { detach: true });
      log.log(`[orchestrator] Created worktree at ${worktreePath} for task ${taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create worktree for task ${taskId}:`, error);
      throw error;
    }

    // Create an OpenCode session for this agent (required)
    let session: AgentSession;
    try {
      session = await this.sessionManager.createSession(taskId);
      log.log(`[orchestrator] Created OpenCode session ${session.sessionId} for task ${taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to create OpenCode session for task ${taskId}:`, error);
      // Clean up the worktree since session creation failed
      try {
        await this.worktreeManager.remove(worktreePath, { force: true });
      } catch (cleanupError) {
        log.error(`[orchestrator] Failed to clean up worktree after session creation failed:`, cleanupError);
      }
      throw error;
    }

    // Send initial message to the session
    try {
      const promptMessage = fillAgentPromptTemplate({
        taskTitle: task.frontmatter.title || "",
        taskDescription: task.description || "",
        worktreePath,
      });

      await this.sessionManager.sendMessage(
        session.sessionId,
        promptMessage,
        worktreePath
      );
      log.log(`[orchestrator] Sent initial message to session ${session.sessionId} for task ${taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to send initial message for task ${taskId}:`, error);
      // Clean up session and worktree since message sending failed
      try {
        await this.sessionManager.removeSession(taskId);
      } catch (cleanupError) {
        log.error(`[orchestrator] Failed to clean up session after message sending failed:`, cleanupError);
      }
      try {
        await this.worktreeManager.remove(worktreePath, { force: true });
      } catch (cleanupError) {
        log.error(`[orchestrator] Failed to clean up worktree after message sending failed:`, cleanupError);
      }
      throw error;
    }

    await this.taskManager.assignTask(taskId, agentId);

    this.runningAgents.set(taskId, {
      taskId,
      agentId,
      startedAt: new Date(),
      status: "running",
      worktreePath,
      session,
    });

    // Start monitoring for idle state to trigger review agent
    await this.reviewAgent.startMonitoring(session);

    log.log(`[orchestrator] Agent ${agentId} started for task ${taskId}`);
  }

  private async stopAgent(taskId: string): Promise<void> {
    const agent = this.runningAgents.get(taskId);
    if (!agent) {
      return;
    }

    agent.status = "stopping";
    log.log(`[orchestrator] Stopping agent ${agent.agentId} for task ${taskId}`);

    // Stop monitoring for idle state
    if (agent.session) {
      this.reviewAgent.stopMonitoring(agent.session.sessionId);
    }

    // Remove the OpenCode session if it exists
    if (agent.session) {
      try {
        await this.sessionManager.removeSession(taskId);
        log.log(`[orchestrator] Removed OpenCode session ${agent.session.sessionId} for task ${taskId}`);
      } catch (error) {
        log.error(`[orchestrator] Failed to remove OpenCode session for task ${taskId}:`, error);
      }
    }

    log.log(`[orchestrator] Agent ${agent.agentId} stopped for task ${taskId}`);

    await this.taskManager.unassignTask(taskId);

    try {
      await this.worktreeManager.remove(agent.worktreePath, { force: true });
      log.log(`[orchestrator] Removed worktree at ${agent.worktreePath} for task ${taskId}`);
    } catch (error) {
      log.error(`[orchestrator] Failed to remove worktree for task ${taskId}:`, error);
    }

    agent.status = "stopped";
  }

  getRunningAgents(): AgentInfo[] {
    return Array.from(this.runningAgents.values());
  }

  isRunning(): boolean {
    return this.abortController !== null;
  }

  getReviewAgent(): ReviewAgent {
    return this.reviewAgent;
  }
}
