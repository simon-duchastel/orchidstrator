/**
 * Agent Instance Interface
 *
 * Exports types and interfaces for abstracting agent instance management
 * across different AI agent implementations.
 */

export type {
  AgentInstance,
  AgentInstanceIdleCallback,
  CreateAgentInstanceOptions,
  AgentInstanceManager,
} from "./types.js";

// Pi implementation
export {
  PiSessionAdapter,
  type PiSessionAdapterOptions,
  createPiSessionAdapter,
} from "./adapters/pi.js";
