/**
 * OpenCode Server Manager
 *
 * Manages the lifecycle of an OpenCode server instance with:
 * - Dynamic port allocation (finding available ports)
 * - Server lifecycle management (start/stop)
 *
 * Note: Authentication is configured via environment variables:
 * - OPENCODE_SERVER_PASSWORD: Required for basic auth
 * - OPENCODE_SERVER_USERNAME: Optional (defaults to "opencode")
 *
 * These should be set by the process that spawns the daemon.
 */

import { createOpencode } from "@opencode-ai/sdk";
import { findAvailablePort } from "./utils/networking.js";

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
 * Encapsulates a running OpenCode server with its configuration.
 * Authentication is handled via environment variables set by the parent process.
 */
export interface OpencodeServerInstance {
  /** The underlying OpenCode server object */
  server: {
    url: string;
    close: () => void;
  };
  /** Server connection information */
  info: OpencodeServerInfo;
  /** Stop the server gracefully */
  stop: () => Promise<void>;
}

/**
 * Create and start a new OpenCode server instance.
 *
 * This function will:
 * 1. Find an available port starting from the provided startPort
 * 2. Start the OpenCode server
 *
 * IMPORTANT: Authentication must be configured via environment variables
 * before calling this function:
 * - OPENCODE_SERVER_PASSWORD: Required for basic auth
 * - OPENCODE_SERVER_USERNAME: Optional (defaults to "opencode")
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

  // Create the OpenCode server
  // Note: Auth is configured via OPENCODE_SERVER_PASSWORD env var
  const opencode = await createOpencode({
    hostname,
    port,
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
    stop,
  };
}

/**
 * Get the Authorization header for making requests to the server.
 *
 * @param username - The username for basic auth
 * @param password - The password for basic auth
 * @returns The Authorization header value
 */
export function getAuthHeader(username: string, password: string): string {
  const authString = `${username}:${password}`;
  return `Basic ${Buffer.from(authString).toString("base64")}`;
}

/**
 * Create a server URL with embedded credentials for authenticated access.
 *
 * @param info - Server connection info
 * @param username - The username for basic auth
 * @param password - The password for basic auth
 * @returns URL with embedded credentials
 */
export function createAuthenticatedUrl(
  info: OpencodeServerInfo,
  username: string,
  password: string
): string {
  const url = new URL(info.url);
  url.username = username;
  url.password = password;
  return url.toString();
}
