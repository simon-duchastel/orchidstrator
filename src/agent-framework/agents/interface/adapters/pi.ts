/**
 * Pi Session Adapter
 *
 * Implements AgentInstanceManager using the @mariozechner/pi-coding-agent SDK.
 */

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  type AgentSession,
  type CreateAgentSessionResult,
} from "@mariozechner/pi-coding-agent";
import {
  type AgentInstanceManager,
  type AgentInstance,
  type AgentInstanceIdleCallback,
  type CreateAgentInstanceOptions,
} from "../types.js";

export interface PiSessionAdapterOptions {
  /** Base directory for all agent instances */
  instancesDir: string;
}

/**
 * Pi agent instance info stored in adapter
 */
interface PiAgentInstanceInfo {
  instanceId: string;
  taskId: string;
  workingDirectory: string;
  createdAt: Date;
  status: "running" | "stopping" | "stopped";
  /** Pi SDK session instance */
  piSession: AgentSession;
  /** Unsubscribe function for event listener */
  unsubscribe: () => void;
}

/**
 * Adapter that implements AgentInstanceManager using Pi SDK.
 */
export class PiSessionAdapter implements AgentInstanceManager {
  private instancesDir: string;
  private instances: Map<string, PiAgentInstanceInfo> = new Map();
  private idleCallbacks: AgentInstanceIdleCallback[] = [];

  constructor(options: PiSessionAdapterOptions) {
    this.instancesDir = options.instancesDir;

    // Ensure the instances directory exists
    if (!existsSync(this.instancesDir)) {
      mkdirSync(this.instancesDir, { recursive: true });
    }
  }

  /**
   * Create a new agent instance.
   */
  async createAgentInstance(options: CreateAgentInstanceOptions): Promise<AgentInstance> {
    // Check if instance already exists
    if (this.instances.has(options.taskId)) {
      throw new Error(`Agent instance for task ${options.taskId} already exists`);
    }

    // Ensure the working directory exists
    if (!existsSync(options.workingDirectory)) {
      mkdirSync(options.workingDirectory, { recursive: true });
    }

    try {
      const resourceLoader = new DefaultResourceLoader({
        systemPromptOverride: () => options.systemPrompt,
        appendSystemPromptOverride: () => [],
      });
      await resourceLoader.reload();

      const result: CreateAgentSessionResult = await createAgentSession({
        cwd: options.workingDirectory,
        resourceLoader,
        sessionManager: SessionManager.inMemory(),
      });

      const instanceId = `pi-${options.taskId}-${Date.now()}`;

      // Subscribe to events to detect when session becomes idle
      const unsubscribe = result.session.subscribe((event) => {
        // Check for events that indicate the agent has finished processing
        if (event.type === "message_end" || event.type === "turn_end") {
          const instanceInfo = this.instances.get(options.taskId);
          if (instanceInfo) {
            this.triggerAgentInstanceIdle(options.taskId, {
              instanceId: instanceInfo.instanceId,
              taskId: instanceInfo.taskId,
              workingDirectory: instanceInfo.workingDirectory,
              createdAt: instanceInfo.createdAt,
              status: "running",
            });
          }
        }
      });

      const instanceInfo: PiAgentInstanceInfo = {
        instanceId,
        taskId: options.taskId,
        workingDirectory: options.workingDirectory,
        createdAt: new Date(),
        status: "running",
        piSession: result.session,
        unsubscribe,
      };

      this.instances.set(options.taskId, instanceInfo);

      return {
        instanceId,
        taskId: options.taskId,
        workingDirectory: options.workingDirectory,
        createdAt: instanceInfo.createdAt,
        status: "running",
      };
    } catch (error) {
      throw new Error(
        `Failed to create Pi agent instance for task ${options.taskId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get an agent instance by task ID.
   */
  async getAgentInstance(taskId: string): Promise<AgentInstance | undefined> {
    const instanceInfo = this.instances.get(taskId);
    if (!instanceInfo) {
      return undefined;
    }

    return {
      instanceId: instanceInfo.instanceId,
      taskId: instanceInfo.taskId,
      workingDirectory: instanceInfo.workingDirectory,
      createdAt: instanceInfo.createdAt,
      status: instanceInfo.status,
    };
  }

  /**
   * Send a message to an agent instance.
   * For Pi, this uses session.prompt() to send a message to the agent.
   */
  async sendMessage(
    instanceId: string,
    message: string,
    _workingDirectory: string
  ): Promise<void> {
    // Find instance by instanceId
    let instanceInfo: PiAgentInstanceInfo | undefined;
    for (const [, info] of this.instances) {
      if (info.instanceId === instanceId) {
        instanceInfo = info;
        break;
      }
    }

    if (!instanceInfo) {
      throw new Error(`Agent instance ${instanceId} not found`);
    }

    try {
      // Send message to the Pi agent using prompt()
      // The agent will process it and emit events that we subscribe to
      await instanceInfo.piSession.prompt(message);
    } catch (error) {
      throw new Error(
        `Failed to send message to Pi agent instance ${instanceId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Remove an agent instance.
   */
  async removeAgentInstance(taskId: string): Promise<void> {
    const instanceInfo = this.instances.get(taskId);
    if (!instanceInfo) {
      throw new Error(`Agent instance for task ${taskId} not found`);
    }

    // Unsubscribe from events
    instanceInfo.unsubscribe();

    // Remove from instances map
    this.instances.delete(taskId);
  }

  /**
   * Stop all active agent instances.
   */
  async stopAllAgentInstances(): Promise<void> {
    for (const [taskId, instanceInfo] of this.instances) {
      // Unsubscribe from events
      instanceInfo.unsubscribe();
    }
    this.instances.clear();
  }

  /**
   * Register a callback for agent instance idle events.
   * For Pi, this is triggered when the agent finishes processing (message_end event).
   */
  onAgentInstanceIdle(callback: AgentInstanceIdleCallback): void {
    this.idleCallbacks.push(callback);
  }

  /**
   * Trigger idle callbacks - called when an agent instance becomes idle.
   */
  private triggerAgentInstanceIdle(taskId: string, instance: AgentInstance): void {
    for (const callback of this.idleCallbacks) {
      try {
        callback(taskId, instance);
      } catch (error) {
        // Log but don't let one callback failure stop others
        console.error("Error in agent instance idle callback:", error);
      }
    }
  }
}

/**
 * Factory function to create a PiSessionAdapter
 */
export function createPiSessionAdapter(
  options: PiSessionAdapterOptions
): PiSessionAdapter {
  return new PiSessionAdapter(options);
}
