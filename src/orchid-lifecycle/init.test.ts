/**
 * Tests for init.ts module
 * Tests orchid initialization workflow with dependency injection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  isOrchidInitialized, 
  validateOrchidStructure, 
  createOrchidStructure, 
  initializeOrchid,
  isDirectoryEmpty
} from './init';
import { MockGitOperations } from '../git/manager.js';

// Mock all file system operations
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock dyson-swarm
vi.mock('dyson-swarm', () => ({
  isInitialized: vi.fn().mockResolvedValue(false),
  initialize: vi.fn().mockResolvedValue(undefined),
}));

// Import mocked functions
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { execSync } from 'child_process';

// Mock: paths module to control directory locations for testing
vi.mock('../paths', () => ({
  getOrchidDir: () => '/tmp/test-orchid/.orchid',
  getPidFile: () => '/tmp/test-orchid/.orchid/orchid.pid',
  getMainRepoDir: () => '/tmp/test-orchid/.orchid/main',
  getWorktreesDir: () => '/tmp/test-orchid/worktrees',
}));

describe('init.ts - Orchid Initialization', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock execSync to do nothing (since we're mocking all file operations)
    vi.mocked(execSync).mockImplementation(() => '');
  });

  describe('isOrchidInitialized', () => {
    it('should return false when .orchid directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(isOrchidInitialized()).toBe(false);
    });

    it('should return false when .orchid exists but main directory does not', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        return pathStr.includes('.orchid') && !pathStr.includes('main');
      });
      expect(isOrchidInitialized()).toBe(false);
    });

    it('should return true when both .orchid and main directories exist', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      expect(isOrchidInitialized()).toBe(true);
    });
  });

  describe('validateOrchidStructure', () => {
    it('should validate correct structure', () => {
      // Set up mocks to simulate correct structure
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('.orchid')) return true;
        if (pathStr.includes('main')) return true;
        if (pathStr.includes('worktrees')) return true;
        if (pathStr.includes('orchid.pid')) return true;
        return false;
      });
      vi.mocked(readFileSync).mockReturnValue('');
      
      const result = validateOrchidStructure();
      
      expect(result).toBe(true);
    });

    it('should validate structure with valid PID', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('12345');
      expect(validateOrchidStructure()).toBe(true);
    });

    it('should reject when .orchid directory missing', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('.orchid')) return false;
        return true;
      });
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when PID file missing', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('orchid.pid')) return false;
        return true;
      });
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when main directory missing', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('main')) return false;
        return true;
      });
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when worktrees directory missing', () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('worktrees')) return false;
        return true;
      });
      expect(validateOrchidStructure()).toBe(false);
    });

    it('should reject when PID file contains invalid content', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('invalid-pid');
      expect(validateOrchidStructure()).toBe(false);
    });
  });

  describe('createOrchidStructure', () => {
    it('should create complete directory structure', () => {
      // Mock existsSync to return false initially (directories don't exist)
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = createOrchidStructure();
      
      expect(result.success).toBe(true);
      expect(vi.mocked(mkdirSync)).toHaveBeenCalledTimes(3); // Should create 3 directories
      expect(vi.mocked(writeFileSync)).toHaveBeenCalledTimes(1); // Should create PID file
    });

    it('should not fail when directories already exist', () => {
      // Mock existsSync to return true (directories already exist)
      vi.mocked(existsSync).mockReturnValue(true);
      
      const result = createOrchidStructure();
      
      expect(result.success).toBe(true);
      expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled(); // Should not create directories
    });

    it('should provide cleanup function', () => {
      // Mock existsSync to return false initially (directories don't exist for creation)
      vi.mocked(existsSync).mockReturnValue(false);
      
      const result = createOrchidStructure();
      
      expect(result.success).toBe(true);
      expect(typeof result.cleanup).toBe('function');
      
      // Mock existsSync to return true for cleanup (files exist now)
      vi.mocked(existsSync).mockReturnValue(true);
      
      // Run cleanup
      result.cleanup?.();
      
      // Verify cleanup was called
      expect(vi.mocked(rmSync)).toHaveBeenCalled();
    });
  });

  describe('isDirectoryEmpty', () => {
    it('should return true when directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = isDirectoryEmpty('/nonexistent/path');

      expect(result).toBe(true);
      expect(existsSync).toHaveBeenCalledWith('/nonexistent/path');
    });

    it('should return true when directory is empty', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue([] as any);

      const result = isDirectoryEmpty('/empty/path');

      expect(result).toBe(true);
      expect(readdirSync).toHaveBeenCalledWith('/empty/path');
    });

    it('should return false when directory has files', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockReturnValue(['file1.txt', 'file2.txt'] as any);

      const result = isDirectoryEmpty('/nonempty/path');

      expect(result).toBe(false);
    });

    it('should return true when readdir throws an error', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = isDirectoryEmpty('/inaccessible/path');

      expect(result).toBe(true);
    });
  });

  describe('initializeOrchid', () => {
    it('should reject when already initialized', async () => {
      // Mock that orchid is already initialized
      vi.mocked(existsSync).mockReturnValue(true);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', {}, mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already initialized');
    });

    it('should reject when directory is not empty and allowNonEmptyDir is false', async () => {
      // Mock that orchid is not initialized, but directory is not empty
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        // Return false for orchid dirs, true for cwd (has files)
        if (pathStr.includes('.orchid') || pathStr.includes('main')) return false;
        return true;
      });
      vi.mocked(readdirSync).mockReturnValue(['existing-file.txt'] as any);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', { allowNonEmptyDir: false }, mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Directory is not empty');
      expect(result.message).toContain('--dangerously-init-in-non-empty-dir');
    });

    it('should allow initialization in non-empty directory when allowNonEmptyDir is true', async () => {
      let createdPaths: string[] = [];
      
      // Mock that orchid is not initialized, directory has files, but allowNonEmptyDir is true
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        // Return false for orchid dirs and main, true for cwd (has files)
        if (pathStr.includes('.orchid') || pathStr.includes('main')) return false;
        return true;
      });
      vi.mocked(readdirSync).mockReturnValue(['existing-file.txt'] as any);
      
      // Track mkdirSync calls
      vi.mocked(mkdirSync).mockImplementation((path) => {
        createdPaths.push(String(path));
        return '';
      });
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', { allowNonEmptyDir: true }, mockGitOps);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully initialized');
    });

    it('should succeed with empty directory (default behavior)', async () => {
      // Mock that orchid is not initialized and directory is empty
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([] as any);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', {}, mockGitOps);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully initialized');
    });

    it('should fail when git clone fails and clean up', async () => {
      let createdPaths: string[] = [];
      
      // Mock that orchid is not initialized initially, directory is empty
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('main')) return false;
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue([] as any);
      
      // Track mkdirSync calls to know which paths were "created"
      vi.mocked(mkdirSync).mockImplementation((path) => {
        createdPaths.push(String(path));
        return '';
      });
      
      // Track rmSync calls
      vi.mocked(rmSync).mockImplementation((path, options) => {
        // Track that cleanup was called with created paths
      });
      
      const mockGitOps = new MockGitOperations(true); // Configure to fail
      const result = await initializeOrchid('https://github.com/user/repo.git', {}, mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Initialization failed');
      
      // Verify that some directories were "created" (mkdirSync called)
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
    });

    it('should succeed with valid repository', async () => {
      // Mock that orchid is not initialized initially and directory is empty
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('main')) return false;
        return false;
      });
      vi.mocked(readdirSync).mockReturnValue([] as any);
      
      const mockGitOps = new MockGitOperations(); // Success case
      const result = await initializeOrchid('https://github.com/user/repo.git', {}, mockGitOps);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully initialized');
      expect(result.message).toContain('https://github.com/user/repo.git');
      expect(result.message).toContain('orchid up');
      
      // Verify structure creation was attempted
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
      expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    });

    it('should reject invalid repository URL', async () => {
      // Mock that orchid is not initialized initially and directory is empty
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readdirSync).mockReturnValue([] as any);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('invalid-url', {}, mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Initialization failed');
      
      // Verify cleanup would be attempted (mkdirSync should have been called for structure creation)
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
    });
  });
  describe('dyson-swarm integration', () => {
    it('should initialize dyson-swarm if not already initialized', async () => {
      const { isInitialized, initialize } = await import('dyson-swarm');
      
      // Mock that dyson-swarm is not initialized
      vi.mocked(isInitialized).mockResolvedValue(false);
      
      // Mock that orchid is not initialized initially
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('main')) return false;
        return false;
      });
      
      vi.mocked(readdirSync).mockReturnValue([] as any);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', {}, mockGitOps);
      
      expect(result.success).toBe(true);
      expect(vi.mocked(isInitialized)).toHaveBeenCalled();
      expect(vi.mocked(initialize)).toHaveBeenCalled();
    });

    it('should skip dyson-swarm initialization if already initialized', async () => {
      const { isInitialized, initialize } = await import('dyson-swarm');
      
      // Mock that dyson-swarm is already initialized
      vi.mocked(isInitialized).mockResolvedValue(true);
      
      // Mock that orchid is not initialized initially
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('main')) return false;
        return false;
      });
      
      vi.mocked(readdirSync).mockReturnValue([] as any);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', {}, mockGitOps);
      
      expect(result.success).toBe(true);
      expect(vi.mocked(isInitialized)).toHaveBeenCalled();
      expect(vi.mocked(initialize)).not.toHaveBeenCalled();
    });
  });
});
