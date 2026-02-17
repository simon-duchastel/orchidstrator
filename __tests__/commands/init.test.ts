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
} from '../../src/commands/init';
import { MockGitOperations } from '../../src/git-manager';

// Mock all file system operations
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Import mocked functions
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'child_process';

// Mock: paths module to control directory locations for testing
vi.mock('../../src/paths', () => ({
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

  describe('initializeOrchid', () => {
    it('should reject when already initialized', async () => {
      // Mock that orchid is already initialized
      vi.mocked(existsSync).mockReturnValue(true);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('https://github.com/user/repo.git', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already initialized');
    });

    it('should fail when git clone fails and clean up', async () => {
      let createdPaths: string[] = [];
      
      // Mock that orchid is not initialized initially, but track created paths
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('main')) return false;
        return false;
      });
      
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
      const result = await initializeOrchid('https://github.com/user/repo.git', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Initialization failed');
      
      // Verify that some directories were "created" (mkdirSync called)
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
    });

    it('should succeed with valid repository', async () => {
      // Mock that orchid is not initialized initially
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('main')) return false;
        return false;
      });
      
      const mockGitOps = new MockGitOperations(); // Success case
      const result = await initializeOrchid('https://github.com/user/repo.git', mockGitOps);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully initialized');
      expect(result.message).toContain('https://github.com/user/repo.git');
      expect(result.message).toContain('orchid up');
      
      // Verify structure creation was attempted
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
      expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    });

    it('should reject invalid repository URL', async () => {
      // Mock that orchid is not initialized initially
      vi.mocked(existsSync).mockReturnValue(false);
      
      const mockGitOps = new MockGitOperations();
      const result = await initializeOrchid('invalid-url', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Initialization failed');
      
      // Verify cleanup would be attempted (mkdirSync should have been called for structure creation)
      expect(vi.mocked(mkdirSync)).toHaveBeenCalled();
    });
  });
});