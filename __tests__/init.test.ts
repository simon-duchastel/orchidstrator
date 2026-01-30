/**
 * Tests for init.ts module
 * Tests orchid initialization workflow with dependency injection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  isOrchidInitialized, 
  validateOrchidStructure, 
  createOrchidStructure, 
  initializeOrchid 
} from '../src/init';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockGitOperations } from '../src/git-manager';
import { execSync } from 'child_process';

// Mock: paths module to control directory locations for testing
vi.mock('../src/paths', () => ({
  getOrchidDir: () => '/tmp/test-orchid/.orchid',
  getPidFile: () => '/tmp/test-orchid/.orchid/orchid.pid',
  getMainRepoDir: () => '/tmp/test-orchid/.orchid/main',
  getWorktreesDir: () => '/tmp/test-orchid/.orchid/worktrees',
}));

describe('init.ts - Orchid Initialization', () => {
  beforeEach(() => {
    // Clean up test directory before each test
    try {
      execSync('rm -rf /tmp/test-orchid', { stdio: 'ignore' });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(() => {
    // Clean up test directory after each test
    try {
      execSync('rm -rf /tmp/test-orchid', { stdio: 'ignore' });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  describe('isOrchidInitialized', () => {
    it('should return false when .orchid directory does not exist', () => {
      expect(isOrchidInitialized()).toBe(false);
    });

    it('should return false when .orchid exists but main directory does not', () => {
      mkdirSync('/tmp/test-orchid/.orchid', { recursive: true });
      expect(isOrchidInitialized()).toBe(false);
    });

    it('should return true when both .orchid and main directories exist', () => {
      mkdirSync('/tmp/test-orchid/.orchid/main', { recursive: true });
      expect(isOrchidInitialized()).toBe(true);
    });
  });

  describe('validateOrchidStructure', () => {
    beforeEach(() => {
      // Create basic structure for validation tests
      mkdirSync('/tmp/test-orchid/.orchid', { recursive: true });
      mkdirSync('/tmp/test-orchid/.orchid/main', { recursive: true });
      mkdirSync('/tmp/test-orchid/.orchid/worktrees', { recursive: true });
    });

    it('should validate correct structure', () => {
      // Create empty PID file
      writeFileSync('/tmp/test-orchid/.orchid/orchid.pid', '');
      expect(validateOrchidStructure()).toBe(true);
    });

    it('should validate structure with valid PID', () => {
      writeFileSync('/tmp/test-orchid/.orchid/orchid.pid', '12345');
      expect(validateOrchidStructure()).toBe(true);
    });

    it('should reject when .orchid directory missing', () => {
      rmSync('/tmp/test-orchid/.orchid', { recursive: true });
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when PID file missing', () => {
      // First remove PID file, then test
      rmSync('/tmp/test-orchid/.orchid/orchid.pid');
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when main directory missing', () => {
      rmSync('/tmp/test-orchid/.orchid/main', { recursive: true });
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when worktrees directory missing', () => {
      rmSync('/tmp/test-orchid/.orchid/worktrees', { recursive: true });
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when PID file contains invalid content', () => {
      writeFileSync('/tmp/test-orchid/.orchid/orchid.pid', 'invalid-pid');
      expect(validateOrchidStructure()).toBe(false);
    });
  });

  describe('createOrchidStructure', () => {
    it('should create complete directory structure', () => {
      const result = createOrchidStructure();
      
      expect(result.success).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid')).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/main')).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/worktrees')).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/orchid.pid')).toBe(true);
      
      // Check PID file is empty
      const pidContent = readFileSync('/tmp/test-orchid/.orchid/orchid.pid', 'utf-8');
      expect(pidContent).toBe('');
    });

    it('should not fail when directories already exist', () => {
      // Pre-create some directories
      mkdirSync('/tmp/test-orchid/.orchid', { recursive: true });
      
      const result = createOrchidStructure();
      
      expect(result.success).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/main')).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/worktrees')).toBe(true);
    });

    it('should provide cleanup function', () => {
      const result = createOrchidStructure();
      
      expect(result.success).toBe(true);
      expect(typeof result.cleanup).toBe('function');
      
      // Verify structure exists
      expect(existsSync('/tmp/test-orchid/.orchid')).toBe(true);
      
      // Run cleanup
      result.cleanup?.();
      
      // Verify cleanup worked
      expect(existsSync('/tmp/test-orchid/.orchid')).toBe(false);
    });
  });

  describe('initializeOrchid', () => {
    it('should reject when already initialized', async () => {
      // Pre-create structure
      createOrchidStructure();
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already initialized');
    });

    it('should fail when git clone fails and clean up', async () => {
      const mockGitOps = new MockGitOperations(true); // Configure to fail
      const result = await initializeOrchid('https://github.com/user/repo.git', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Initialization failed');
      
      // Verify cleanup happened
      expect(existsSync('/tmp/test-orchid/.orchid')).toBe(false);
    });

    it('should succeed with valid repository', async () => {
      const mockGitOps = new MockGitOperations(); // Success case
      const result = await initializeOrchid('https://github.com/user/repo.git', mockGitOps);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully initialized');
      expect(result.message).toContain('https://github.com/user/repo.git');
      expect(result.message).toContain('orchid up');
      
      // Verify structure was created
      expect(existsSync('/tmp/test-orchid/.orchid')).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/main')).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/worktrees')).toBe(true);
      expect(existsSync('/tmp/test-orchid/.orchid/orchid.pid')).toBe(true);
    });

    it('should reject invalid repository URL', async () => {
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('invalid-url', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Initialization failed');
      
      // Verify cleanup happened
      expect(existsSync('/tmp/test-orchid/.orchid')).toBe(false);
    });
  });
});