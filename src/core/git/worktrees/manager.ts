import simpleGit, { SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import type { WorktreeInfo, CreateWorktreeOptions, RemoveWorktreeOptions } from './types.js';

export class WorktreeManager {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async list(): Promise<WorktreeInfo[]> {
    try {
      const result = await this.git.raw(['worktree', 'list', '--porcelain']);
      const lines = result.split('\n');
      const worktrees: WorktreeInfo[] = [];
      
      let currentWorktree: Partial<WorktreeInfo> = {};
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('worktree ')) {
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as WorktreeInfo);
          }
          currentWorktree = {
            path: line.substring(10).trim(),
            dirty: false
          };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring(5).trim();
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring(7).trim().replace('refs/heads/', '');
        } else if (line.startsWith('bare')) {
          // Skip bare worktrees
        } else if (line.startsWith('detached')) {
          currentWorktree.branch = 'DETACHED';
        }
      }
      
      // Add the last worktree
      if (currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
      }
      
      // Check dirty status for each worktree
      for (const worktree of worktrees) {
        try {
          const worktreeGit = simpleGit(worktree.path);
          const status = await worktreeGit.status();
          worktree.dirty = !status.isClean();
        } catch (error) {
          // If we can't check status, assume not dirty
          worktree.dirty = false;
        }
      }
      
      return worktrees;
    } catch (error) {
      throw new Error(`Failed to list worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async create(path: string, ref: string, options: CreateWorktreeOptions = {}): Promise<boolean> {
    try {
      const args = ['worktree', 'add'];
      
      if (options.force) {
        args.push('-f');
      }
      
      if (options.detach) {
        args.push('--detach');
      }
      
      args.push(path, ref);
      
      await this.git.raw(args);
      return true;
    } catch (error) {
      throw new Error(`Failed to create worktree at ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async remove(path: string, options: RemoveWorktreeOptions = {}): Promise<boolean> {
    try {
      // First try to remove the worktree
      const args = ['worktree', 'remove'];
      
      if (options.force) {
        args.push('--force');
      }
      
      args.push(path);
      
      await this.git.raw(args);
      return true;
    } catch (error) {
      throw new Error(`Failed to remove worktree at ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async prune(): Promise<number> {
    try {
      const beforeList = await this.list();
      const beforeCount = beforeList.length;
      
      await this.git.raw(['worktree', 'prune']);
      
      const afterList = await this.list();
      const afterCount = afterList.length;
      
      return beforeCount - afterCount;
    } catch (error) {
      throw new Error(`Failed to prune worktrees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getWorktreePath(worktreeRef: string): Promise<string | null> {
    const worktrees = await this.list();
    const worktree = worktrees.find(wt => 
      wt.path === worktreeRef || 
      wt.branch === worktreeRef || 
      wt.commit.startsWith(worktreeRef)
    );
    return worktree ? worktree.path : null;
  }

  async isWorktree(path: string): Promise<boolean> {
    try {
      const worktrees = await this.list();
      const resolvedPath = resolve(path);
      return worktrees.some(wt => resolve(wt.path) === resolvedPath);
    } catch (error) {
      return false;
    }
  }
}
