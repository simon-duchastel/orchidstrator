/**
 * Agent Instance Interface Types
 *
 * Abstracts different agent instance management approaches.
 * YAGNI - only includes methods and types currently used by agents.
 */

/**
 * Represents an agent instance
 */
export interface AgentInstance {
  /** Unique instance identifier */
  instanceId: string;
  /** The task/agent this instance belongs to */
  taskId: string;
  /** Path to the instance's working directory */
  workingDirectory: string;
  /** When the instance was created */
  createdAt: Date;
  /** Instance status */
  status: "running" | "stopping" | "stopped";
}

/**
 * Callback type for agent instance idle events
 */
export type AgentInstanceIdleCallback = (taskId: string, instance: AgentInstance) => void;

/**
 * Options for creating an agent instance
 */
export interface CreateAgentInstanceOptions {
  /** The task ID (used as the instance identifier) */
  taskId: string;
  /** Path to the working directory */
  workingDirectory: string;
  /** System prompt to override the default */
  systemPrompt: string;
  /** Model configuration for the agent instance */
  model: {
    provider: string;
    modelId: string;
  };
  /** Optional path to session file for resuming/attaching to existing session */
  sessionFilePath?: string;
}

/**
 * Interface for agent instance managers.
 * Abstracts different AI agent implementations.
 */
export interface AgentInstanceManager {
  /**
   * Create a new agent instance.
   *
   * @param options - Agent instance creation options
   * @returns The created agent instance
   * @throws Error if instance already exists or creation fails
   */
  createAgentInstance(options: CreateAgentInstanceOptions): Promise<AgentInstance>;

  /**
   * Get an agent instance by task ID.
   *
   * @param taskId - The task identifier
   * @returns The agent instance or undefined if not found
   */
  getAgentInstance(taskId: string): Promise<AgentInstance | undefined>;

  /**
   * Send a message to an agent instance.
   *
   * @param instanceId - The instance ID
   * @param message - The message text to send
   * @param workingDirectory - The working directory for the instance
   * @throws Error if message sending fails
   */
  sendMessage(
    instanceId: string,
    message: string,
    workingDirectory: string
  ): Promise<void>;

  /**
   * Remove an agent instance.
   *
   * @param taskId - The task identifier
   * @throws Error if instance doesn't exist
   */
  removeAgentInstance(taskId: string): Promise<void>;

  /**
   * Stop all active agent instances.
   */
  stopAllAgentInstances(): Promise<void>;

  /**
   * Register a callback for agent instance idle events.
   * Called when an agent instance becomes idle (completes its work).
   *
   * @param callback - Function to call when an agent instance becomes idle
   */
  onAgentInstanceIdle(callback: AgentInstanceIdleCallback): void;
}
