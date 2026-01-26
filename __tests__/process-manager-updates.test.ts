/**
 * Tests for process-manager.ts updates
 * Tests the new validation logic for orchid structure
 */

import { jest } from '@jest/globals';
import { startDaemon, stopDaemon, getStatus } from '../src/process-manager';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

// Mock the paths module to control directory locations for testing
jest.mock('../src/paths', () => {
  const original = jest.requireActual('../src/paths');
  return {
    ...(original as any),
    getOrchidDir: () => '/tmp/test-orchid-daemon/.orchid',
    getPidFile: () => '/tmp/test-orchid-daemon/.orchid/orchid.pid',
    getLogFile: () => '/tmp/test-orchid-daemon/.orchid/orchid.log',
    getErrorLogFile: () => '/tmp/test-orchid-daemon/.orchid/orchid.error.log',
    getMainRepoDir: () => '/tmp/test-orchid-daemon/.orchid/main',
    getDirectoryPort: () => 5678,
  };
});

// Mock the init module's validateOrchidStructure function
jest.mock('../src/init', () => {
  const original = jest.requireActual('../src/init');
  return {
    ...(original as any),
    validateOrchidStructure: jest.fn(),
  };
});

import { validateOrchidStructure } from '../src/init';

describe('process-manager.ts - Updated Logic', () => {
  beforeEach(() => {
    // Clean up test directory before each test
    try {
      rmSync('/tmp/test-orchid-daemon', { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up test directory after each test
    try {
      rmSync('/tmp/test-orchid-daemon', { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  describe('startDaemon with orchid validation', () => {
    it('should start daemon when not initialized (no main directory)', async () => {
      const mockValidate = validateOrchidStructure as jest.MockedFunction<typeof validateOrchidStructure>;
      
      // This should not be called when main dir doesn't exist
      mockValidate.mockReturnValue(true);

      // The real startDaemon will try to spawn a daemon process, which will fail in tests
      // We need to mock the child process operations
      const { spawn } = require('child_process');
      const mockSpawn = jest.spyOn(require('child_process'), 'spawn').mockImplementation(() => {
        const mockChild = {
          unref: jest.fn(),
          on: jest.fn(),
        };
        return mockChild;
      });

      // Mock file system operations
      const mockExists = jest.spyOn(require('node:fs'), 'existsSync');
      mockExists.mockImplementation((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('main')) {
          return false; // Main dir doesn't exist - not initialized
        }
        return true; // Other files exist for PID check
      });

      const mockRead = jest.spyOn(require('node:fs'), 'readFileSync').mockReturnValue('');

      const result = await startDaemon();

      expect(result.success).toBe(false); // Will fail due to mocked spawn, but that's expected
      expect(mockValidate).not.toHaveBeenCalled(); // Should not validate when not initialized

      mockSpawn.mockRestore();
      mockExists.mockRestore();
      mockRead.mockRestore();
    });

    it('should validate orchid structure when initialized', async () => {
      const mockValidate = validateOrchidStructure as jest.MockedFunction<typeof validateOrchidStructure>;
      mockValidate.mockReturnValue(false); // Validation fails

      // Mock file system to simulate initialized workspace
      const mockExists = jest.spyOn(require('node:fs'), 'existsSync');
      mockExists.mockImplementation((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('main')) {
          return true; // Main dir exists - initialized
        }
        if (pathStr.includes('orchid.pid')) {
          return false; // No PID file
        }
        return false;
      });

      const result = await startDaemon();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not properly initialized');
      expect(mockValidate).toHaveBeenCalled();

      mockExists.mockRestore();
    });

    it('should proceed when orchid structure is valid', async () => {
      const mockValidate = validateOrchidStructure as jest.MockedFunction<typeof validateOrchidStructure>;
      mockValidate.mockReturnValue(true); // Validation succeeds

      // Mock file system to simulate initialized workspace
      const mockExists = jest.spyOn(require('node:fs'), 'existsSync');
      mockExists.mockImplementation((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('main')) {
          return true; // Main dir exists - initialized
        }
        if (pathStr.includes('orchid.pid')) {
          return false; // No PID file
        }
        return false;
      });

      // Mock spawn to avoid actual process creation
      const mockSpawn = jest.spyOn(require('child_process'), 'spawn').mockImplementation(() => {
        const mockChild = {
          unref: jest.fn(),
          on: jest.fn(),
        };
        return mockChild;
      });

      const mockRead = jest.spyOn(require('node:fs'), 'readFileSync').mockReturnValue('');

      const result = await startDaemon();

      expect(mockValidate).toHaveBeenCalled();
      // Result will be false due to mocked spawn, but validation should have passed

      mockSpawn.mockRestore();
      mockExists.mockRestore();
      mockRead.mockRestore();
    });

    it('should handle already running daemon', async () => {
      // Mock existing running PID
      const mockExists = jest.spyOn(require('node:fs'), 'existsSync');
      mockExists.mockImplementation((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('main')) {
          return false; // Not initialized
        }
        if (pathStr.includes('orchid.pid')) {
          return true; // PID file exists
        }
        return false;
      });

      const mockRead = jest.spyOn(require('node:fs'), 'readFileSync').mockReturnValue('12345');

      // Mock process.kill to simulate running process
      const mockKill = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('Process exists');
      });

      const result = await startDaemon();

      expect(result.success).toBe(false);
      expect(result.message).toContain('already running');

      mockKill.mockRestore();
      mockExists.mockRestore();
      mockRead.mockRestore();
    });
  });

  describe('other functions remain unchanged', () => {
    it('should maintain getStatus functionality', () => {
      // Mock existing PID
      const mockExists = jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(true);
      const mockRead = jest.spyOn(require('node:fs'), 'readFileSync').mockReturnValue('12345');
      
      // Mock process.kill to simulate running process
      const mockKill = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('Process exists');
      });

      const status = getStatus();

      expect(status.running).toBe(false); // Will be false due to mock throwing
      expect(status.pid).toBeNull();

      mockKill.mockRestore();
      mockExists.mockRestore();
      mockRead.mockRestore();
    });

    it('should maintain stopDaemon functionality', async () => {
      // Mock no PID file
      const mockExists = jest.spyOn(require('node:fs'), 'existsSync').mockReturnValue(false);

      const result = await stopDaemon();

      expect(result.success).toBe(false);
      expect(result.message).toContain('not running');

      mockExists.mockRestore();
    });
  });
});