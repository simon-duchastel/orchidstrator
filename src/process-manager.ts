/**
 * Process Manager
 *
 * Handles starting and stopping the orchid daemon process.
 * Uses PID file to track running instance and manages the daemon lifecycle.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, mkdirSync, openSync, closeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPidFile,
  getLogFile,
  getErrorLogFile,
  getDirectoryPort,
  getOrchidDir,
  getMainRepoDir,
} from "./paths";
import { validateOrchidStructure } from "./commands";

/**
 * Check if a process with the given PID is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the PID of the running daemon, if any
 */
export function getRunningPid(): number | null {
  const pidFile = getPidFile();
  if (!existsSync(pidFile)) {
    return null;
  }

  try {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
    if (isNaN(pid)) {
      return null;
    }

    // Verify the process is actually running
    if (!isProcessRunning(pid)) {
      // Stale PID file - clean it up
      unlinkSync(pidFile);
      return null;
    }

    return pid;
  } catch {
    return null;
  }
}

/**
 * Check if the daemon is currently running
 */
export function isRunning(): boolean {
  return getRunningPid() !== null;
}

/**
 * Start the daemon process
 *
 * @returns Object with success status and message
 */
export async function startDaemon(): Promise<{ success: boolean; message: string }> {
  // Check if already running
  const existingPid = getRunningPid();
  if (existingPid !== null) {
    return {
      success: false,
      message: `Orchid is already running (PID: ${existingPid})`,
    };
  }

  // Check for corrupted setup: PID file exists but main directory doesn't
  const pidFile = getPidFile();
  const mainRepoDir = getMainRepoDir();
  if (existsSync(pidFile) && !existsSync(mainRepoDir)) {
    return {
      success: false,
      message: "Orchid workspace is corrupted: PID file exists but main repository directory is missing. Please reinitialize with 'orchid init <repository-url>'.",
    };
  }

  // Validate orchid structure if this is an initialized workspace
  if (existsSync(getMainRepoDir())) {
    if (!validateOrchidStructure()) {
      return {
        success: false,
        message: "Orchid workspace is not properly initialized. Please run 'orchid init <repository-url>' to set up the workspace.",
      };
    }
  }

  // Get directory-specific paths
  const orchidDir = getOrchidDir();
  const logFile = getLogFile();
  const errorLogFile = getErrorLogFile();
  const port = getDirectoryPort();

  // Ensure orchid directory exists
  if (!existsSync(orchidDir)) {
    mkdirSync(orchidDir, { recursive: true });
  }

  // Find the daemon script
  // In development, it's at src/daemon.ts (run via tsx)
  // In production, it's at dist/daemon.js
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const daemonScript = join(__dirname, "daemon.js");
  const isDev = !existsSync(daemonScript);

  // Open log files
  const outFd = openSync(logFile, "a");
  const errFd = openSync(errorLogFile, "a");

  try {
    let child;

    if (isDev) {
      // Development mode - use tsx
      const devDaemonScript = join(__dirname, "daemon.ts");
      child = spawn("npx", ["tsx", devDaemonScript], {
        detached: true,
        stdio: ["ignore", outFd, errFd],
        env: { ...process.env },
      });
    } else {
      // Production mode - run the compiled JS
      child = spawn("node", [daemonScript], {
        detached: true,
        stdio: ["ignore", outFd, errFd],
        env: { ...process.env },
      });
    }

    // Let the child run independently
    child.unref();

    // Wait a moment for the daemon to start and write its PID
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify it started
    const pid = getRunningPid();
    if (pid !== null) {
      return {
        success: true,
        message: `Orchid started (PID: ${pid})\nServer: http://127.0.0.1:${port}\nLogs: ${logFile}`,
      };
    } else {
      return {
        success: false,
        message: `Failed to start orchid. Check logs at ${errorLogFile}`,
      };
    }
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Stop the running daemon
 */
export async function stopDaemon(): Promise<{ success: boolean; message: string }> {
  const pid = getRunningPid();

  if (pid === null) {
    return {
      success: false,
      message: "Orchid is not running",
    };
  }

  try {
    process.kill(pid, "SIGTERM");

    for (let i = 0; i < 10; i++) {
      if (!isProcessRunning(pid)) break;
      await sleep(100);
    }

    if (isProcessRunning(pid)) {
      process.kill(pid, "SIGKILL");
    }

    const pidFile = getPidFile();
    if (existsSync(pidFile)) {
      unlinkSync(pidFile);
    }

    return {
      success: true,
      message: `Orchid stopped (was PID: ${pid})`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to stop orchid: ${err}`,
    };
  }
}

/**
 * Get status information about the daemon
 */
export function getStatus(): {
  running: boolean;
  pid: number | null;
  serverUrl: string | null;
} {
  const pid = getRunningPid();
  const port = getDirectoryPort();
  return {
    running: pid !== null,
    pid,
    serverUrl: pid !== null ? `http://127.0.0.1:${port}` : null,
  };
}
