import { promises as fs } from 'fs';
import { join } from 'path';
import type { Task, TaskFrontmatter } from './types.js';

export class TaskFileUtils {
  /**
   * Parse task file with frontmatter
   */
  static async parseTaskFile(filePath: string): Promise<{ frontmatter: TaskFrontmatter; description: string }> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseTaskContent(content);
  }

  /**
   * Parse task content string with frontmatter
   */
  static parseTaskContent(content: string): { frontmatter: TaskFrontmatter; description: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      throw new Error('Invalid task file format: missing frontmatter');
    }

    const frontmatterStr = match[1];
    const description = match[2].trim();
    
    // Parse YAML-like frontmatter
    const frontmatter: TaskFrontmatter = {
      title: '',
    };

    const lines = frontmatterStr.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmedLine.substring(0, colonIndex).trim();
      let value = trimmedLine.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      
      if (key === 'title') {
        frontmatter.title = value;
      } else if (key === 'assignee') {
        frontmatter.assignee = value;
      }
    }

    if (!frontmatter.title) {
      throw new Error('Invalid task file format: missing title in frontmatter');
    }

    return { frontmatter, description };
  }

  /**
   * Convert task to task file string with frontmatter
   */
  static taskToFileString(task: Task): string {
    const frontmatter: string[] = [`title: "${task.frontmatter.title}"`];
    
    if (task.frontmatter.assignee) {
      frontmatter.push(`assignee: "${task.frontmatter.assignee}"`);
    }

    const frontmatterStr = frontmatter.join('\n');
    const description = task.description || '';

    return `---\n${frontmatterStr}\n---\n${description}`;
  }

  /**
   * Write task to task file
   */
  static async writeTaskFile(filePath: string, task: Task): Promise<void> {
    const taskString = this.taskToFileString(task);
    await fs.writeFile(filePath, taskString, 'utf-8');
  }

  /**
   * Generate task ID (UUID v4)
   */
  static generateTaskId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  static async dirExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get all task IDs from a status directory
   */
  static async getTaskIdsFromDir(statusDir: string): Promise<string[]> {
    if (!(await this.dirExists(statusDir))) {
      return [];
    }

    const entries = await fs.readdir(statusDir, { withFileTypes: true });
    return entries
      .filter(entry => {
        // For main tasks, we look for directories
        if (entry.isDirectory()) return true;
        // For subtasks, we look for .task files
        if (entry.isFile() && entry.name.endsWith('.task')) return true;
        return false;
      })
      .map(entry => {
        // For directories, return the directory name
        if (entry.isDirectory()) return entry.name;
        // For files, remove the .task extension
        return entry.name.replace('.task', '');
      });
  }

  /**
   * Get all sub-task IDs from a task's sub-tasks directory
   */
  static async getSubtaskIdsFromDir(subtasksDir: string): Promise<string[]> {
    const subtaskIds: string[] = [];
    
    if (!(await this.dirExists(subtasksDir))) {
      return subtaskIds;
    }

    const statuses: Array<'open' | 'in-progress' | 'closed'> = ['open', 'in-progress', 'closed'];
    
    for (const status of statuses) {
      const statusDir = join(subtasksDir, status);
      const taskIds = await this.getTaskIdsFromDir(statusDir);
      subtaskIds.push(...taskIds);
    }

    return subtaskIds;
  }
}