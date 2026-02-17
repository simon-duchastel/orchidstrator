import { join, resolve } from "node:path";

/**
 * Generate a consistent hash from a path string
 * This is a pure function - no side effects
 */
export function generatePortHash(path: string): number {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Convert a path hash to a port number in the range 4000-9999
 * This is a pure function - no side effects
 */
export function hashToPort(hash: number): number {
  return 4000 + (Math.abs(hash) % 6000);
}

/**
 * Generate a unique port for this directory based on the current working directory path
 */
export function getDirectoryPort(cwdProvider: () => string = () => process.cwd()): number {
  const currentDir = resolve(cwdProvider());
  const hash = generatePortHash(currentDir);
  return hashToPort(hash);
}

/**
 * Base directory for orchid configuration and state (per-directory)
 */
export function getOrchidDir(cwdProvider: () => string = () => process.cwd()): string {
  return join(resolve(cwdProvider()), '.orchid');
}

/**
 * Path to the PID file that tracks the running daemon (per-directory)
 */
export function getPidFile(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'orchid.pid');
}

/**
 * Path to the log file for daemon output (per-directory)
 */
export function getLogFile(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'orchid.log');
}

/**
 * Path to the error log file (per-directory)
 */
export function getErrorLogFile(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'orchid.error.log');
}

/**
 * Path to the main repository clone
 */
export function getMainRepoDir(cwdProvider?: () => string): string {
  return join(getOrchidDir(cwdProvider), 'main');
}

/**
 * Path to the worktrees directory
 */
export function getWorktreesDir(cwdProvider?: () => string): string {
  return join(resolve(cwdProvider ? cwdProvider() : process.cwd()), 'worktrees');
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
