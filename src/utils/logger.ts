/**
 * Logger utility for Orchid
 *
 * By default, logging is disabled. Can be enabled by setting verbose mode.
 */

export interface LoggerOptions {
  verbose?: boolean;
  prefix?: string;
}

class Logger {
  private verbose = false;
  private prefix = "";

  constructor(options: LoggerOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.prefix = options.prefix ? `[${options.prefix}] ` : "";
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix ? `[${prefix}] ` : "";
  }

  log(...args: unknown[]): void {
    if (this.verbose) {
      console.log(this.prefix, ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.verbose) {
      console.error(this.prefix, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.verbose) {
      console.warn(this.prefix, ...args);
    }
  }
}

// Default logger instance (disabled by default)
export const log = new Logger();

// Create a logger with a specific prefix
export function createLogger(prefix: string, options: LoggerOptions = {}): Logger {
  return new Logger({ ...options, prefix });
}

// Enable verbose logging globally
export function setVerboseLogging(verbose: boolean): void {
  log.setVerbose(verbose);
}
