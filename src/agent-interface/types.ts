export interface AgentSession {
  sessionId: string;
  taskId: string;
  workingDirectory: string;
  createdAt: Date;
  status: "running" | "stopping" | "stopped";
}

export type SessionIdleCallback = (taskId: string, session: AgentSession) => void;

export interface CreateSessionOptions {
  taskId: string;
  workingDirectory: string;
  systemPrompt: string;
}

export interface SessionManagerInterface {
  createSession(options: CreateSessionOptions): Promise<AgentSession>;
  getSession(taskId: string): Promise<AgentSession | undefined>;
  sendMessage(
    sessionId: string,
    message: string,
    workingDirectory: string
  ): Promise<void>;
  removeSession(taskId: string): Promise<void>;
  stopAllSessions(): Promise<void>;
  onSessionIdle(callback: SessionIdleCallback): void;
}
