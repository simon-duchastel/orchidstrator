/**
 * Agent Session Interface
 *
 * Exports types and interfaces for abstracting session management
 * across different AI agent implementations.
 */

export type {
  AgentSession,
  SessionIdleCallback,
  CreateSessionOptions,
  SessionManagerInterface,
} from "./types.js";

// Pi implementation
export {
  PiSessionAdapter,
  type PiSessionAdapterOptions,
  createPiSessionAdapter,
} from "./adapters/pi.js";
