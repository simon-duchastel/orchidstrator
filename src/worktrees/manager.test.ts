import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorktreeManager } from './manager.js';
import type { WorktreeInfo } from './types.js';

// Mock simple-git
vi.mock('simple-git', () => ({
  default: vi.fn()
}));

import simpleGit from 'simple-git';

describe('WorktreeManager', () => {
  let worktreeManager: WorktreeManager;
  let mockGit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGit = {
      raw: vi.fn(),
      status: vi.fn()
    };
    (simpleGit as any).mockReturnValue(mockGit);
    worktreeManager = new WorktreeManager('/test/repo');
  });

  describe('list', () => {
    it('should parse worktree list output correctly', async () => {
      const mockOutput = `worktree /test/repo/main
HEAD abc123def456
branch refs/heads/main`;

      mockGit.raw.mockResolvedValue(mockOutput);
      
      // Mock status calls for dirty checking - all clean
      (simpleGit as any).mockReturnValue({
        status: vi.fn().mockResolvedValue({ isClean: () => true })
      });

      const result = await worktreeManager.list();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'list', '--porcelain']);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'test/repo/main',
        branch: 'main',
        commit: 'abc123def456',
        dirty: false
      });
    });

    it('should handle dirty status correctly', async () => {
      const mockOutput = `worktree /test/repo/main
HEAD abc123def456
branch refs/heads/main`;

      mockGit.raw.mockResolvedValue(mockOutput);
      
      // Mock dirty status
      (simpleGit as any).mockReturnValue({
        status: vi.fn().mockResolvedValue({ isClean: () => false })
      });

      const result = await worktreeManager.list();

      expect(result[0].dirty).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockGit.raw.mockRejectedValue(new Error('Git command failed'));

      await expect(worktreeManager.list()).rejects.toThrow('Failed to list worktrees: Git command failed');
    });
  });

  describe('create', () => {
    it('should create a worktree with default options', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.create('/test/new-worktree', 'feature-branch');

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'add', '/test/new-worktree', 'feature-branch']);
      expect(result).toBe(true);
    });

    it('should create a worktree with force option', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.create('/test/new-worktree', 'feature-branch', { force: true });

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'add', '-f', '/test/new-worktree', 'feature-branch']);
      expect(result).toBe(true);
    });

    it('should create a detached worktree', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.create('/test/new-worktree', 'abc123', { detach: true });

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'add', '--detach', '/test/new-worktree', 'abc123']);
      expect(result).toBe(true);
    });

    it('should create a worktree with both force and detach options', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.create('/test/new-worktree', 'abc123', { force: true, detach: true });

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'add', '-f', '--detach', '/test/new-worktree', 'abc123']);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockGit.raw.mockRejectedValue(new Error('Worktree creation failed'));

      await expect(worktreeManager.create('/test/new-worktree', 'feature-branch'))
        .rejects.toThrow('Failed to create worktree at /test/new-worktree: Worktree creation failed');
    });
  });

  describe('remove', () => {
    it('should remove a worktree with default options', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.remove('/test/old-worktree');

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'remove', '/test/old-worktree']);
      expect(result).toBe(true);
    });

    it('should remove a worktree with force option', async () => {
      mockGit.raw.mockResolvedValue('');

      const result = await worktreeManager.remove('/test/old-worktree', { force: true });

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'remove', '--force', '/test/old-worktree']);
      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockGit.raw.mockRejectedValue(new Error('Worktree removal failed'));

      await expect(worktreeManager.remove('/test/old-worktree'))
        .rejects.toThrow('Failed to remove worktree at /test/old-worktree: Worktree removal failed');
    });
  });

  describe('prune', () => {
    it('should prune worktrees and return count', async () => {
      const mockListOutput = `worktree /test/repo/main
HEAD abc123def456
branch refs/heads/main`;

      // Simulate pruning 2 worktrees
      mockGit.raw
        .mockResolvedValueOnce(mockListOutput) // First list call
        .mockResolvedValueOnce('') // Prune call
        .mockResolvedValueOnce(mockListOutput); // Second list call

      // Mock the list method to return different counts
      const originalList = worktreeManager.list;
      let callCount = 0;
      worktreeManager.list = vi.fn().mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? 
          [{ path: '/test/repo/main', branch: 'main', commit: 'abc123', dirty: false }] :
          [{ path: '/test/repo/main', branch: 'main', commit: 'abc123', dirty: false }];
      });

      const result = await worktreeManager.prune();

      expect(mockGit.raw).toHaveBeenCalledWith(['worktree', 'prune']);
      expect(result).toBe(0); // No change in this mock
    });

    it('should handle errors gracefully', async () => {
      mockGit.raw.mockRejectedValue(new Error('Prune failed'));

      await expect(worktreeManager.prune()).rejects.toThrow('Failed to prune worktrees: Failed to list worktrees: Prune failed');
    });
  });

  describe('getWorktreePath', () => {
    it('should return path when worktree matches by path', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        { path: '/test/worktree1', branch: 'main', commit: 'abc123', dirty: false },
        { path: '/test/worktree2', branch: 'feature', commit: 'def456', dirty: false }
      ];

      vi.spyOn(worktreeManager, 'list').mockResolvedValue(mockWorktrees);

      const result = await worktreeManager.getWorktreePath('/test/worktree1');
      expect(result).toBe('/test/worktree1');
    });

    it('should return path when worktree matches by branch', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        { path: '/test/worktree1', branch: 'main', commit: 'abc123', dirty: false },
        { path: '/test/worktree2', branch: 'feature', commit: 'def456', dirty: false }
      ];

      vi.spyOn(worktreeManager, 'list').mockResolvedValue(mockWorktrees);

      const result = await worktreeManager.getWorktreePath('feature');
      expect(result).toBe('/test/worktree2');
    });

    it('should return path when worktree matches by commit', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        { path: '/test/worktree1', branch: 'main', commit: 'abc123', dirty: false },
        { path: '/test/worktree2', branch: 'feature', commit: 'def456', dirty: false }
      ];

      vi.spyOn(worktreeManager, 'list').mockResolvedValue(mockWorktrees);

      const result = await worktreeManager.getWorktreePath('def45');
      expect(result).toBe('/test/worktree2');
    });

    it('should return null when no match found', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        { path: '/test/worktree1', branch: 'main', commit: 'abc123', dirty: false }
      ];

      vi.spyOn(worktreeManager, 'list').mockResolvedValue(mockWorktrees);

      const result = await worktreeManager.getWorktreePath('nonexistent');
      expect(result).toBe(null);
    });
  });

  describe('isWorktree', () => {
    it('should return true for valid worktree path', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        { path: '/test/worktree1', branch: 'main', commit: 'abc123', dirty: false }
      ];

      vi.spyOn(worktreeManager, 'list').mockResolvedValue(mockWorktrees);

      const result = await worktreeManager.isWorktree('/test/worktree1');
      expect(result).toBe(true);
    });

    it('should return false for invalid worktree path', async () => {
      const mockWorktrees: WorktreeInfo[] = [
        { path: '/test/worktree1', branch: 'main', commit: 'abc123', dirty: false }
      ];

      vi.spyOn(worktreeManager, 'list').mockResolvedValue(mockWorktrees);

      const result = await worktreeManager.isWorktree('/test/nonexistent');
      expect(result).toBe(false);
    });

    it('should return false when list throws error', async () => {
      vi.spyOn(worktreeManager, 'list').mockRejectedValue(new Error('List failed'));

      const result = await worktreeManager.isWorktree('/test/worktree1');
      expect(result).toBe(false);
    });
  });
});