import { join, resolve } from "node:path";

/**
 * Base directory for orchid configuration and state (per-directory)
 */
export function getOrchidDir(): string {
  return join(resolve(process.cwd()), '.orchid');
}

/**
 * Path to the PID file that tracks the running daemon (per-directory)
 */
export function getPidFile(): string {
  return join(getOrchidDir(), 'orchid.pid');
}

/**
 * Path to the log file for daemon output (per-directory)
 */
export function getLogFile(): string {
  return join(getOrchidDir(), 'orchid.log');
}

/**
 * Path to the error log file (per-directory)
 */
export function getErrorLogFile(): string {
  return join(getOrchidDir(), 'orchid.error.log');
}

/**
 * Generate a unique port for this directory based on the current working directory path
 */
export function getDirectoryPort(): number {
  const currentDir = resolve(process.cwd());
  
  // Create a hash of the path to generate a consistent port
  let hash = 0;
  for (let i = 0; i < currentDir.length; i++) {
    const char = currentDir.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and map to port range 4000-9999
  const port = 4000 + (Math.abs(hash) % 6000);
  return port;
}

/**
 * Default port for the OpenCode server (directory-specific)
 */
export const DEFAULT_PORT = getDirectoryPort();

/**
 * Default hostname for the OpenCode server
 */
export const DEFAULT_HOSTNAME = "127.0.0.1";

// Legacy exports for backward compatibility
export const ORCHID_DIR = getOrchidDir();
export const PID_FILE = getPidFile();
export const LOG_FILE = getLogFile();
export const ERROR_LOG_FILE = getErrorLogFile();
