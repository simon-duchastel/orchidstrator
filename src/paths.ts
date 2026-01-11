import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Base directory for orchid configuration and state
 */
export const ORCHID_DIR = join(homedir(), ".orchid");

/**
 * Path to the PID file that tracks the running daemon
 */
export const PID_FILE = join(ORCHID_DIR, "orchid.pid");

/**
 * Path to the log file for daemon output
 */
export const LOG_FILE = join(ORCHID_DIR, "orchid.log");

/**
 * Path to the error log file
 */
export const ERROR_LOG_FILE = join(ORCHID_DIR, "orchid.error.log");

/**
 * Default port for the OpenCode server
 */
export const DEFAULT_PORT = 4096;

/**
 * Default hostname for the OpenCode server
 */
export const DEFAULT_HOSTNAME = "127.0.0.1";
