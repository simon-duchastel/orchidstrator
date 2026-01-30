/**
 * Tests for paths.ts module
 * These tests focus on pure functions we extracted for testability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generatePortHash,
  hashToPort,
  getDirectoryPort,
  getOrchidDir,
  getPidFile,
  getLogFile,
  getErrorLogFile,
  getMainRepoDir,
  getWorktreesDir,
} from '../src/paths';

describe('paths.ts - Pure Functions', () => {
  describe('generatePortHash', () => {
    it('should generate consistent hash for same input', () => {
      const path = '/Users/test/project';
      const hash1 = generatePortHash(path);
      const hash2 = generatePortHash(path);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const path1 = '/Users/test/project1';
      const path2 = '/Users/test/project2';
      const hash1 = generatePortHash(path1);
      const hash2 = generatePortHash(path2);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = generatePortHash('');
      expect(typeof hash).toBe('number');
      expect(hash).toBe(0); // Empty string should hash to 0
    });

    it('should handle special characters', () => {
      const pathWithSpecialChars = '/path/with-special@chars#123';
      const hash = generatePortHash(pathWithSpecialChars);
      expect(typeof hash).toBe('number');
      expect(hash).not.toBeNaN();
    });

    it('should produce 32-bit integer', () => {
      const path = '/some/very/long/path/that/should/still/work';
      const hash = generatePortHash(path);
      expect(hash).toBeGreaterThanOrEqual(-2147483648);
      expect(hash).toBeLessThanOrEqual(2147483647);
    });
  });

  describe('hashToPort', () => {
    it('should convert hash to port in valid range', () => {
      const port1 = hashToPort(0);
      const port2 = hashToPort(12345);
      const port3 = hashToPort(-12345);
      const port4 = hashToPort(2147483647);
      const port5 = hashToPort(-2147483648);

      [port1, port2, port3, port4, port5].forEach(port => {
        expect(port).toBeGreaterThanOrEqual(4000);
        expect(port).toBeLessThanOrEqual(9999);
      });
    });

    it('should be deterministic', () => {
      const hash = 12345;
      const port1 = hashToPort(hash);
      const port2 = hashToPort(hash);
      expect(port1).toBe(port2);
    });

    it('should handle zero hash', () => {
      const port = hashToPort(0);
      expect(port).toBe(4000);
    });

    it('should handle negative hashes correctly', () => {
      const port1 = hashToPort(-1);
      const port2 = hashToPort(-100);
      expect(port1).toBeGreaterThanOrEqual(4000);
      expect(port1).toBeLessThanOrEqual(9999);
      expect(port2).toBeGreaterThanOrEqual(4000);
      expect(port2).toBeLessThanOrEqual(9999);
    });
  });

  describe('getDirectoryPort', () => {
    it('should use provided cwd provider', () => {
      const mockCwd = '/mock/current/directory';
      const port = getDirectoryPort(() => mockCwd);
      expect(port).toBeGreaterThanOrEqual(4000);
      expect(port).toBeLessThanOrEqual(9999);
    });

    it('should be consistent for same directory', () => {
      const mockCwd = '/consistent/directory';
      const port1 = getDirectoryPort(() => mockCwd);
      const port2 = getDirectoryPort(() => mockCwd);
      expect(port1).toBe(port2);
    });

    it('should produce different ports for different directories', () => {
      const port1 = getDirectoryPort(() => '/directory/one');
      const port2 = getDirectoryPort(() => '/directory/two');
      expect(port1).not.toBe(port2);
    });

    it('should handle root directory', () => {
      const port = getDirectoryPort(() => '/');
      expect(port).toBeGreaterThanOrEqual(4000);
      expect(port).toBeLessThanOrEqual(9999);
    });

    it('should handle very long paths', () => {
      const longPath = '/very/deep/nested/directory/structure/that/goes/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on/and/on';
      const port = getDirectoryPort(() => longPath);
      expect(port).toBeGreaterThanOrEqual(4000);
      expect(port).toBeLessThanOrEqual(9999);
    });
  });

  describe('getOrchidDir', () => {
    it('should use provided cwd provider', () => {
      const mockCwd = '/mock/current/directory';
      const orchidDir = getOrchidDir(() => mockCwd);
      expect(orchidDir).toBe('/mock/current/directory/.orchid');
    });

    it('should handle nested directories', () => {
      const mockCwd = '/users/test/projects/my-app';
      const orchidDir = getOrchidDir(() => mockCwd);
      expect(orchidDir).toBe('/users/test/projects/my-app/.orchid');
    });

    it('should handle root directory', () => {
      const orchidDir = getOrchidDir(() => '/');
      expect(orchidDir).toBe('/.orchid');
    });
  });

  describe('Path file functions', () => {
    it('should generate correct PID file path', () => {
      const pidFile = getPidFile(() => '/test/directory');
      expect(pidFile).toBe('/test/directory/.orchid/orchid.pid');
    });

    it('should generate correct log file path', () => {
      const logFile = getLogFile(() => '/test/directory');
      expect(logFile).toBe('/test/directory/.orchid/orchid.log');
    });

    it('should generate correct error log file path', () => {
      const errorLogFile = getErrorLogFile(() => '/test/directory');
      expect(errorLogFile).toBe('/test/directory/.orchid/orchid.error.log');
    });

    it('should generate correct main repo directory path', () => {
      const mainRepoDir = getMainRepoDir(() => '/test/directory');
      expect(mainRepoDir).toBe('/test/directory/.orchid/main');
    });

    it('should generate correct worktrees directory path', () => {
      const worktreesDir = getWorktreesDir(() => '/test/directory');
      expect(worktreesDir).toBe('/test/directory/.orchid/worktrees');
    });
  });

  describe('Integration tests', () => {
    it('should produce consistent results across the full pipeline', () => {
      const mockCwd = '/consistent/project/directory';
      
      const port1 = getDirectoryPort(() => mockCwd);
      const orchidDir1 = getOrchidDir(() => mockCwd);
      const mainRepoDir1 = getMainRepoDir(() => mockCwd);
      const worktreesDir1 = getWorktreesDir(() => mockCwd);
      
      const port2 = getDirectoryPort(() => mockCwd);
      const orchidDir2 = getOrchidDir(() => mockCwd);
      const mainRepoDir2 = getMainRepoDir(() => mockCwd);
      const worktreesDir2 = getWorktreesDir(() => mockCwd);
      
      expect(port1).toBe(port2);
      expect(orchidDir1).toBe(orchidDir2);
      expect(mainRepoDir1).toBe(mainRepoDir2);
      expect(worktreesDir1).toBe(worktreesDir2);
      expect(port1).toBeGreaterThanOrEqual(4000);
      expect(port1).toBeLessThanOrEqual(9999);
      expect(orchidDir1).toBe('/consistent/project/directory/.orchid');
      expect(mainRepoDir1).toBe('/consistent/project/directory/.orchid/main');
      expect(worktreesDir1).toBe('/consistent/project/directory/.orchid/worktrees');
    });

    it('should handle edge case paths consistently', () => {
      const edgeCases = [
        '',
        '/',
        '/tmp',
        '/very/deep/nested/path/with/many/segments',
        '/path/with-dashes/and_underscores/and.dots',
        '/path/with/unicode/🚀/characters',
      ];

      edgeCases.forEach(path => {
        const port = getDirectoryPort(() => path);
        expect(port).toBeGreaterThanOrEqual(4000);
        expect(port).toBeLessThanOrEqual(9999);
        
        // Should be consistent
        const port2 = getDirectoryPort(() => path);
        expect(port).toBe(port2);
      });
    });
  });
});