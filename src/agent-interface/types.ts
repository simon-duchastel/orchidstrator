/**
 * Agent Session Interface Types
 *
 * Abstracts both opencode (HTTP server) and pi (SDK) session management approaches.
 * YAGNI - only includes methods and types currently used by agents.
 */

/**
 * Represents an agent session
 */
export interface AgentSession {
  /** Unique session identifier */
  sessionId: string;
  /** The task/agent this session belongs to */
  taskId: string;
  /** Path to the session's working directory */
  workingDirectory: string;
  /** When the session was created */
  createdAt: Date;
  /** Session status */
  status: "running" | "stopping" | "stopped";
}

/**
 * Callback type for session idle events
 */
export type SessionIdleCallback = (taskId: string, session: AgentSession) => void;

/**
 * Options for creating a session
 */
export interface CreateSessionOptions {
  /** The task ID (used as the session identifier) */
  taskId: string;
  /** Path to the working directory */
  workingDirectory: string;
}

/**
 * Interface for session managers.
 * Abstracts both opencode and pi implementations.
 */
export interface SessionManagerInterface {
  /**
   * Create a new session for an agent.
   *
   * @param options - Session creation options
   * @returns The created session
   * @throws Error if session already exists or creation fails
   */
  createSession(options: CreateSessionOptions): Promise<AgentSession>;

  /**
   * Get a session by task ID.
   *
   * @param taskId - The task identifier
   * @returns The session or undefined if not found
   */
  getSession(taskId: string): Promise<AgentSession | undefined>;

  /**
   * Send a message to a session.
   *
   * @param sessionId - The session ID
   * @param message - The message text to send
   * @param workingDirectory - The working directory for the session
   * @throws Error if message sending fails
   */
  sendMessage(
    sessionId: string,
    message: string,
    workingDirectory: string
  ): Promise<void>;

  /**
   * Register a callback for session idle events.
   * Called when a session becomes idle (completes its work).
   *
   * @param callback - Function to call when a session becomes idle
   */
  onSessionIdle(callback: SessionIdleCallback): void;
}
