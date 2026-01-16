import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Find the git repository root by traversing up from current directory
 */
function findGitRoot(startPath: string = process.cwd()): string | null {
  let currentPath = resolve(startPath);
  
  while (currentPath !== '/') {
    if (existsSync(join(currentPath, '.git'))) {
      return currentPath;
    }
    currentPath = resolve(currentPath, '..');
  }
  
  return null;
}

/**
 * Base directory for orchid configuration and state (per-repo)
 */
export function getOrchidDir(): string {
  const gitRoot = findGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository. Orchidstrator requires a git repository.');
  }
  return join(gitRoot, '.orchid');
}

/**
 * Path to the PID file that tracks the running daemon (per-repo)
 */
export function getPidFile(): string {
  return join(getOrchidDir(), 'orchid.pid');
}

/**
 * Path to the log file for daemon output (per-repo)
 */
export function getLogFile(): string {
  return join(getOrchidDir(), 'orchid.log');
}

/**
 * Path to the error log file (per-repo)
 */
export function getErrorLogFile(): string {
  return join(getOrchidDir(), 'orchid.error.log');
}

/**
 * Generate a unique port for this repository based on git root path
 */
export function getRepoPort(): number {
  const gitRoot = findGitRoot();
  if (!gitRoot) {
    return 4096; // fallback
  }
  
  // Create a hash of the path to generate a consistent port
  let hash = 0;
  for (let i = 0; i < gitRoot.length; i++) {
    const char = gitRoot.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and map to port range 4000-9999
  const port = 4000 + (Math.abs(hash) % 6000);
  return port;
}

/**
 * Default port for the OpenCode server (repo-specific)
 */
export const DEFAULT_PORT = getRepoPort();

/**
 * Default hostname for the OpenCode server
 */
export const DEFAULT_HOSTNAME = "127.0.0.1";

// Legacy exports for backward compatibility
export const ORCHID_DIR = getOrchidDir();
export const PID_FILE = getPidFile();
export const LOG_FILE = getLogFile();
export const ERROR_LOG_FILE = getErrorLogFile();
