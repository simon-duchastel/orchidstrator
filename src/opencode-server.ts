/**
 * OpenCode Server Manager
 *
 * Manages the lifecycle of an OpenCode server instance with:
 * - Dynamic port allocation (finding available ports)
 * - Secure authentication (random credentials)
 * - Server lifecycle management (start/stop)
 *
 * Credentials are stored only in memory and never persisted to disk,
 * ensuring only orchid can communicate with this server instance.
 */

import { createOpencode } from "@opencode-ai/sdk";
import { findAvailablePort } from "./utils/networking.js";
import {
  generateServerCredentials,
  type ServerCredentials,
  validateCredentials,
} from "./utils/credentials.js";

export interface OpencodeServerConfig {
  /** Hostname to bind to (default: 127.0.0.1) */
  hostname?: string;
  /** Starting port number (will find next available if taken) */
  startPort: number;
  /** Maximum attempts to find an available port (default: 100) */
  maxPortAttempts?: number;
}

export interface OpencodeServerInfo {
  /** The URL of the running server */
  url: string;
  /** The port the server is listening on */
  port: number;
  /** The hostname the server is bound to */
  hostname: string;
}

/**
 * OpenCode Server Instance
 *
 * Encapsulates a running OpenCode server with its configuration
 * and authentication credentials.
 */
export interface OpencodeServerInstance {
  /** The underlying OpenCode server object */
  server: {
    url: string;
    close: () => void;
  };
  /** Server connection information */
  info: OpencodeServerInfo;
  /** Authentication credentials (stored only in memory) */
  credentials: ServerCredentials;
  /** Stop the server gracefully */
  stop: () => Promise<void>;
}

/**
 * Create and start a new OpenCode server instance.
 *
 * This function will:
 * 1. Find an available port starting from the provided startPort
 * 2. Generate cryptographically secure random credentials
 * 3. Start the OpenCode server with authentication enabled
 *
 * The credentials are only stored in memory and never written to disk,
 * ensuring only the orchid process that started the server can access it.
 *
 * @param config - Server configuration
 * @returns Promise that resolves to the server instance
 * @throws Error if no available port is found or server fails to start
 */
export async function createOpencodeServer(
  config: OpencodeServerConfig
): Promise<OpencodeServerInstance> {
  const hostname = config.hostname ?? "127.0.0.1";
  const maxAttempts = config.maxPortAttempts ?? 100;

  // Find an available port
  const port = await findAvailablePort(config.startPort, hostname, maxAttempts);

  // Generate secure credentials
  const credentials = generateServerCredentials();
  validateCredentials(credentials);

  // Create the OpenCode server with authentication
  const opencode = await createOpencode({
    hostname,
    port,
    auth: {
      type: "basic",
      username: credentials.username,
      password: credentials.password,
    },
  });

  const info: OpencodeServerInfo = {
    url: opencode.server.url,
    port,
    hostname,
  };

  const stop = async (): Promise<void> => {
    return new Promise((resolve) => {
      try {
        opencode.server.close();
        resolve();
      } catch {
        resolve();
      }
    });
  };

  return {
    server: opencode.server,
    info,
    credentials,
    stop,
  };
}

/**
 * Get the Authorization header for making requests to the server.
 *
 * @param credentials - The server credentials
 * @returns The Authorization header value
 */
export function getAuthHeader(credentials: ServerCredentials): string {
  const authString = `${credentials.username}:${credentials.password}`;
  return `Basic ${Buffer.from(authString).toString("base64")}`;
}

/**
 * Create a server URL with embedded credentials for authenticated access.
 *
 * @param info - Server connection info
 * @param credentials - Server credentials
 * @returns URL with embedded credentials
 */
export function createAuthenticatedUrl(
  info: OpencodeServerInfo,
  credentials: ServerCredentials
): string {
  const url = new URL(info.url);
  url.username = credentials.username;
  url.password = credentials.password;
  return url.toString();
}
