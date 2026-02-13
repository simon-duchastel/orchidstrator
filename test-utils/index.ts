/**
 * Test utilities for orchid testing
 */

export interface MockProcess {
  pid: number;
  killed: boolean;
  signals: string[];
}

export class TestHelper {
  /**
   * Create a temporary directory for testing
   */
  static async withTempDirectory<T>(fn: (dir: string) => Promise<T>): Promise<T> {
    const { mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    
    const tempDir = mkdtempSync(join(tmpdir(), 'orchid-test-'));
    try {
      return await fn(tempDir);
    } finally {
      const { rmSync } = await import('fs');
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Mock process for testing process management
   */
  static createMockProcess(pid: number): MockProcess {
    return {
      pid,
      killed: false,
      signals: []
    };
  }

  /**
   * Wait for async operations to complete
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Capture console output for testing
   */
  static captureConsole() {
    const logs: { type: 'log' | 'error' | 'warn'; message: string }[] = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => logs.push({ type: 'log', message: args.join(' ') });
    console.error = (...args) => logs.push({ type: 'error', message: args.join(' ') });
    console.warn = (...args) => logs.push({ type: 'warn', message: args.join(' ') });

    return {
      logs,
      restore: () => {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
      }
    };
  }

  /**
   * Mock process.exit() for testing
   */
  static mockProcessExit() {
    let exitCode: number | null = null;
    const originalExit = process.exit;

    process.exit = (code?: number) => {
      exitCode = code || 0;
      throw new Error(`process.exit(${code}) called`);
    };

    return {
      getExitCode: () => exitCode,
      restore: () => {
        process.exit = originalExit;
      }
    };
  }
}
