/**
 * Tests for git-manager.ts module
 * Tests git operations with dependency injection for mocking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ProductionGitOperations, 
  MockGitOperations, 
  cloneRepository, 
  getRepositoryInfo,
  defaultGitOperations 
} from './manager.js';

describe('git-manager.ts - Git Operations', () => {
  describe('ProductionGitOperations', () => {
    let gitOps: ProductionGitOperations;

    beforeEach(() => {
      gitOps = new ProductionGitOperations();
    });

    describe('validateRepoUrl', () => {
      it('should validate HTTPS git URLs', () => {
        expect(gitOps.validateRepoUrl('https://github.com/user/repo.git')).toBe(true);
        expect(gitOps.validateRepoUrl('https://gitlab.com/user/repo.git')).toBe(true);
        expect(gitOps.validateRepoUrl('http://github.com/user/repo.git')).toBe(true);
      });

      it('should validate SSH git URLs', () => {
        expect(gitOps.validateRepoUrl('git@github.com:user/repo.git')).toBe(true);
        expect(gitOps.validateRepoUrl('git@gitlab.com:user/repo.git')).toBe(true);
      });

      it('should validate HTTPS URLs without .git extension', () => {
        expect(gitOps.validateRepoUrl('https://github.com/user/repo')).toBe(true);
        expect(gitOps.validateRepoUrl('https://gitlab.com/user/repo')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(gitOps.validateRepoUrl('not-a-url')).toBe(false);
        expect(gitOps.validateRepoUrl('ftp://example.com/repo.git')).toBe(false);
        expect(gitOps.validateRepoUrl('')).toBe(false);
        expect(gitOps.validateRepoUrl('github.com/user/repo')).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(gitOps.validateRepoUrl('https://github.com/')).toBe(false);
        expect(gitOps.validateRepoUrl('https://github.com/user')).toBe(false);
        expect(gitOps.validateRepoUrl('git@')).toBe(false);
      });
    });

    describe('clone', () => {
      it('should throw error for clone operations (TODO)', async () => {
        await expect(gitOps.clone('https://github.com/user/repo.git', '/tmp/repo'))
          .rejects.toThrow('Git clone operation not yet implemented');
      });
    });
  });

  describe('MockGitOperations', () => {
    describe('successful operations', () => {
      let gitOps: MockGitOperations;

      beforeEach(() => {
        gitOps = new MockGitOperations();
      });

      it('should validate simple URLs', () => {
        expect(gitOps.validateRepoUrl('user/repo')).toBe(true);
        expect(gitOps.validateRepoUrl('github.com/user/repo')).toBe(true);
      });

      it('should reject invalid simple URLs', () => {
        expect(gitOps.validateRepoUrl('')).toBe(false);
        expect(gitOps.validateRepoUrl('user')).toBe(false);
        expect(gitOps.validateRepoUrl('a')).toBe(false);
      });

      it('should perform mock clone successfully', async () => {
        await expect(gitOps.clone('user/repo', '/tmp/repo'))
          .resolves.not.toThrow();
      });
    });

    describe('failing operations', () => {
      let gitOps: MockGitOperations;

      beforeEach(() => {
        gitOps = new MockGitOperations(true); // Set clone to fail
      });

      it('should fail clone when configured to do so', async () => {
        await expect(gitOps.clone('user/repo', '/tmp/repo'))
          .rejects.toThrow('Mock git clone failed');
      });
    });
  });

  describe('cloneRepository', () => {
    it('should reject invalid URLs', async () => {
      const mockGitOps = new MockGitOperations();
      const result = await cloneRepository('invalid-url', '/tmp/repo', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid git repository URL');
    });

    it('should handle clone failures', async () => {
      const mockGitOps = new MockGitOperations(true); // Configure to fail
      const result = await cloneRepository('valid/repo', '/tmp/repo', mockGitOps);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to clone repository');
    });

    it('should succeed with valid URL and successful clone', async () => {
      const mockGitOps = new MockGitOperations();
      const result = await cloneRepository('valid/repo', '/tmp/repo', mockGitOps);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully cloned');
    });

    it('should use default git operations when none provided', async () => {
      // This will fail with TODO error, which is expected
      const result = await cloneRepository('https://github.com/user/repo.git', '/tmp/repo');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Git clone operation not yet implemented');
    });
  });

  describe('getRepositoryInfo', () => {
    it('should return null (TODO)', () => {
      expect(getRepositoryInfo('https://github.com/user/repo.git')).toBe(null);
      expect(getRepositoryInfo('git@github.com:user/repo.git')).toBe(null);
    });
  });

  describe('defaultGitOperations', () => {
    it('should be an instance of ProductionGitOperations', () => {
      expect(defaultGitOperations).toBeInstanceOf(ProductionGitOperations);
    });
  });
});
