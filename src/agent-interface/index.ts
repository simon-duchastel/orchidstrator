/**
 * Agent Session Interface
 *
 * Exports types and interfaces for abstracting session management
 * across different AI agent implementations (opencode, pi, etc.)
 */

// Types
export type {
  AgentSession,
  SessionIdleCallback,
  CreateSessionOptions,
  SessionManagerInterface,
} from "./types.js";

// OpenCode implementation
export {
  OpencodeSessionManager,
  type OpencodeSessionManagerOptions,
  createOpencodeSessionManager,
} from "./opencode/index.js";

// Pi implementation
export {
  PiSessionAdapter,
  type PiSessionAdapterOptions,
  createPiSessionAdapter,
} from "./adapters/pi.js";
