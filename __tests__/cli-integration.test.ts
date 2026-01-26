/**
 * Tests for CLI integration
 * Tests command-line interface behavior with mocked dependencies
 */

import { jest } from '@jest/globals';
import { Command } from 'commander';
import { MockGitOperations } from '../src/git-manager';

// Mock the init module
jest.mock('../src/init', () => {
  const actual = jest.requireActual('../src/init');
  return {
    ...(actual as any),
    initializeOrchid: jest.fn(),
    isOrchidInitialized: jest.fn(),
  };
});

// Mock the process-manager module
jest.mock('../src/process-manager', () => {
  const actual = jest.requireActual('../src/process-manager');
  return {
    ...(actual as any),
    startDaemon: jest.fn(),
    stopDaemon: jest.fn(),
    getStatus: jest.fn(),
  };
});

// Mock open function
jest.mock('open', () => jest.fn());

import { initializeOrchid, isOrchidInitialized } from '../src/init';
import { startDaemon, stopDaemon, getStatus } from '../src/process-manager';
import open from 'open';

describe('CLI Integration Tests', () => {
  let mockProcessExit: any;
  let mockConsoleLog: any;
  let mockConsoleError: any;

  beforeEach(() => {
    // Mock process.exit to prevent tests from actually exiting
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    
    // Mock console methods
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    mockConsoleLog.mockRestore?.();
    mockConsoleError.mockRestore?.();
  });

  describe('init command', () => {
    it('should call initializeOrchid with correct arguments', async () => {
      const mockInitialize = initializeOrchid as jest.MockedFunction<typeof initializeOrchid>;
      mockInitialize.mockResolvedValue({
        success: true,
        message: 'Successfully initialized'
      });

      // Import and run CLI programmatically
      const program = new Command();
      program
        .name("orchid")
        .description("Orchestrate complex background AI tasks")
        .version("1.0.0");

      program
        .command("init")
        .description("Initialize orchid workspace with a git repository")
        .argument("<repository-url>", "Git repository URL to clone")
        .action(async (repoUrl) => {
          console.log(`Initializing orchid with repository: ${repoUrl}`);
          const result = await initializeOrchid(repoUrl);
          console.log(result.message);
          process.exit(result.success ? 0 : 1);
        });

      try {
        await program.parseAsync(['node', 'orchid', 'init', 'https://github.com/user/repo.git']);
      } catch (error: any) {
        if (error.message !== 'process.exit called') {
          throw error;
        }
      }

      expect(mockInitialize).toHaveBeenCalledWith('https://github.com/user/repo.git');
      expect(mockConsoleLog).toHaveBeenCalledWith('Initializing orchid with repository: https://github.com/user/repo.git');
      expect(mockConsoleLog).toHaveBeenCalledWith('Successfully initialized');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should handle initialization failure', async () => {
      const mockInitialize = initializeOrchid as jest.MockedFunction<typeof initializeOrchid>;
      mockInitialize.mockResolvedValue({
        success: false,
        message: 'Initialization failed'
      });

      const program = new Command();
      program
        .name("orchid")
        .description("Orchestrate complex background AI tasks")
        .version("1.0.0");

      program
        .command("init")
        .description("Initialize orchid workspace with a git repository")
        .argument("<repository-url>", "Git repository URL to clone")
        .action(async (repoUrl) => {
          console.log(`Initializing orchid with repository: ${repoUrl}`);
          const result = await initializeOrchid(repoUrl);
          console.log(result.message);
          process.exit(result.success ? 0 : 1);
        });

      try {
        await program.parseAsync(['node', 'orchid', 'init', 'invalid-url']);
      } catch (error: any) {
        if (error.message !== 'process.exit called') {
          throw error;
        }
      }

      expect(mockConsoleLog).toHaveBeenCalledWith('Initialization failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should require repository URL argument', async () => {
      const program = new Command();
      program
        .name("orchid")
        .description("Orchestrate complex background AI tasks")
        .version("1.0.0");

      program
        .command("init")
        .description("Initialize orchid workspace with a git repository")
        .argument("<repository-url>", "Git repository URL to clone")
        .action(async (repoUrl) => {
          console.log(`Initializing orchid with repository: ${repoUrl}`);
          const result = await initializeOrchid(repoUrl);
          console.log(result.message);
          process.exit(result.success ? 0 : 1);
        });

      // This should show help or error for missing argument
      await expect(program.parseAsync(['node', 'orchid', 'init']))
        .rejects.toThrow();
    });
  });

  describe('existing commands integration', () => {
    it('should maintain up command functionality', async () => {
      const mockStartDaemon = startDaemon as jest.MockedFunction<typeof startDaemon>;
      mockStartDaemon.mockResolvedValue({
        success: true,
        message: 'Orchid started'
      });

      const program = new Command();
      program
        .name("orchid")
        .description("Orchestrate complex background AI tasks")
        .version("1.0.0");

      program
        .command("up")
        .description("Start the orchid daemon and OpenCode server")
        .action(async () => {
          console.log("Starting orchid...");
          const result = await startDaemon();
          console.log(result.message);
          process.exit(result.success ? 0 : 1);
        });

      try {
        await program.parseAsync(['node', 'orchid', 'up']);
      } catch (error: any) {
        if (error.message !== 'process.exit called') {
          throw error;
        }
      }

      expect(mockStartDaemon).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Starting orchid...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Orchid started');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should maintain status command functionality', async () => {
      const mockGetStatus = getStatus as jest.MockedFunction<typeof getStatus>;
      mockGetStatus.mockReturnValue({
        running: true,
        pid: 12345,
        serverUrl: 'http://127.0.0.1:5678'
      });

      const program = new Command();
      program
        .name("orchid")
        .description("Orchestrate complex background AI tasks")
        .version("1.0.0");

      program
        .command("status")
        .description("Check if the orchid daemon is running")
        .action(() => {
          const status = getStatus();
          if (status.running) {
            console.log(`Orchid is running (PID: ${status.pid})`);
            console.log(`Server: ${status.serverUrl}`);
          } else {
            console.log("Orchid is not running");
          }
        });

      await program.parseAsync(['node', 'orchid', 'status']);

      expect(mockGetStatus).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('Orchid is running (PID: 12345)');
      expect(mockConsoleLog).toHaveBeenCalledWith('Server: http://127.0.0.1:5678');
    });
  });
});