import lock from 'proper-lockfile';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus, CreateTaskOptions, UpdateTaskOptions, TaskFilter, TaskManagerOptions } from './types.js';
import { TaskFileUtils } from './file-utils.js';
import {
  getTasksDir,
  getTaskLockFile,
  getTaskStatusDir,
  getTaskDir,
  getTaskFile,
  getSubtasksDir,
} from '../paths.js';

export class TaskManager {
  private cwdProvider: () => string;

  constructor(options: TaskManagerOptions = {}) {
    this.cwdProvider = options.cwdProvider || (() => process.cwd());
  }

  /**
   * Execute an operation with the task lock held
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockfilePath = getTaskLockFile(this.cwdProvider);
    
    // Ensure tasks directory exists
    await TaskFileUtils.ensureDir(getTasksDir(this.cwdProvider));
    
    // Create the lockfile if it doesn't exist
    if (!(await TaskFileUtils.fileExists(lockfilePath))) {
      await fs.writeFile(lockfilePath, '', 'utf-8');
    }
    
    const release = await lock.lock(lockfilePath, {
      retries: {
        retries: 10,
        minTimeout: 100,
        maxTimeout: 1000,
      },
    });

    try {
      return await operation();
    } finally {
      await release();
    }
  }

  /**
   * Get task status from file path
   */
  private getTaskStatusFromPath(taskPath: string): TaskStatus {
    if (taskPath.includes('/in-progress/')) return 'in-progress';
    if (taskPath.includes('/closed/')) return 'closed';
    return 'open';
  }

  /**
   * Load a task from its file
   */
  private async loadTaskFromFile(taskId: string, status: TaskStatus): Promise<Task | null> {
    const taskFile = getTaskFile(taskId, status, this.cwdProvider);
    
    if (!(await TaskFileUtils.fileExists(taskFile))) {
      return null;
    }

    try {
      const { frontmatter, description } = await TaskFileUtils.parseTaskFile(taskFile);
      const subtasks = await this.loadSubtasks(taskId, status);
      
      return {
        id: taskId,
        frontmatter,
        description,
        status,
        subtasks,
      };
    } catch (error) {
      throw new Error(`Failed to load task ${taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load subtasks for a given task
   */
  private async loadSubtasks(parentId: string, parentStatus: TaskStatus): Promise<Task[]> {
    const subtasksDir = getSubtasksDir(parentId, parentStatus, this.cwdProvider);
    const subtasks: Task[] = [];

    // Check each status directory for subtasks
    for (const status of ['open', 'in-progress', 'closed'] as TaskStatus[]) {
      const statusDir = join(subtasksDir, status);
      const taskIds = await TaskFileUtils.getTaskIdsFromDir(statusDir);
      
      for (const subtaskId of taskIds) {
        const subtask = await this.loadSubtask(subtaskId, parentId, status);
        if (subtask) {
          subtasks.push(subtask);
        }
      }
    }

    return subtasks;
  }

  /**
   * Load a specific subtask
   */
  private async loadSubtask(taskId: string, parentId: string, status: TaskStatus): Promise<Task | null> {
    const subtaskFile = join(getSubtasksDir(parentId, 'open', this.cwdProvider), status, `${taskId}.md`);
    
    if (!(await TaskFileUtils.fileExists(subtaskFile))) {
      return null;
    }

    try {
      const { frontmatter, description } = await TaskFileUtils.parseTaskFile(subtaskFile);
      
      return {
        id: taskId,
        frontmatter,
        description,
        status,
      };
    } catch (error) {
      throw new Error(`Failed to load subtask ${taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new task
   */
  async createTask(options: CreateTaskOptions): Promise<Task> {
    return this.withLock(async () => {
      const taskId = uuidv4();
      const task: Task = {
        id: taskId,
        frontmatter: {
          title: options.title,
          assignee: options.assignee,
        },
        description: options.description,
        status: options.assignee ? 'in-progress' : 'open',
        subtasks: [],
      };

      // Create task directory and file
      const taskDir = getTaskDir(taskId, task.status, this.cwdProvider);
      const taskFile = getTaskFile(taskId, task.status, this.cwdProvider);
      
      await TaskFileUtils.ensureDir(taskDir);
      await TaskFileUtils.writeTaskFile(taskFile, task);

      // Create subtasks if provided
      if (options.subtasks && options.subtasks.length > 0) {
        const subtasks: Task[] = [];
        
        for (const subtaskOptions of options.subtasks) {
          const subtaskId = uuidv4();
          const subtask: Task = {
            id: subtaskId,
            frontmatter: {
              title: subtaskOptions.title,
            },
            description: subtaskOptions.description,
            status: 'open',
          };

          const subtaskDir = join(getSubtasksDir(taskId, task.status, this.cwdProvider), 'open');
          const subtaskFile = join(subtaskDir, `${subtaskId}.md`);
          
          await TaskFileUtils.ensureDir(subtaskDir);
          await TaskFileUtils.writeTaskFile(subtaskFile, subtask);
          
          subtasks.push(subtask);
        }
        
        task.subtasks = subtasks;
      }

      return task;
    });
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    return this.withLock(async () => {
      // Try each status
      for (const status of ['open', 'in-progress', 'closed'] as TaskStatus[]) {
        const task = await this.loadTaskFromFile(taskId, status);
        if (task) return task;
      }
      return null;
    });
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(filter: TaskFilter = {}): Promise<Task[]> {
    return this.withLock(async () => {
      const tasks: Task[] = [];
      const statuses: TaskStatus[] = filter.status ? [filter.status] : ['open', 'in-progress', 'closed'];

      for (const status of statuses) {
        const statusDir = getTaskStatusDir(status, this.cwdProvider);
        const taskIds = await TaskFileUtils.getTaskIdsFromDir(statusDir);

        for (const taskId of taskIds) {
          const task = await this.loadTaskFromFile(taskId, status);
          if (task) {
            // Apply filters
            if (filter.assignee && task.frontmatter.assignee !== filter.assignee) {
              continue;
            }
            if (filter.hasSubtasks !== undefined) {
              const hasSubtasks = task.subtasks && task.subtasks.length > 0;
              if (filter.hasSubtasks !== hasSubtasks) {
                continue;
              }
            }
            
            tasks.push(task);
          }
        }
      }

      return tasks;
    });
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, options: UpdateTaskOptions): Promise<Task | null> {
    return this.withLock(async () => {
      // Find the task
      let task: Task | null = null;
      let currentStatus: TaskStatus | null = null;
      
      for (const status of ['open', 'in-progress', 'closed'] as TaskStatus[]) {
        task = await this.loadTaskFromFile(taskId, status);
        if (task) {
          currentStatus = status;
          break;
        }
      }

      if (!task || !currentStatus) {
        return null;
      }

      // Update fields
      if (options.title !== undefined) {
        task.frontmatter.title = options.title;
      }
      if (options.description !== undefined) {
        task.description = options.description;
      }
      if (options.assignee !== undefined) {
        task.frontmatter.assignee = options.assignee;
      }

      // Update status based on assignee
      let newStatus = currentStatus;
      if (options.assignee && currentStatus === 'open') {
        newStatus = 'in-progress';
      } else if (options.assignee === undefined && (currentStatus === 'in-progress' || currentStatus === 'closed')) {
        newStatus = 'open';
        // Remove assignee when going back to open
        task.frontmatter.assignee = undefined;
      }

      // If status changed, move the task
      if (newStatus !== currentStatus) {
        // Remove old task directory
        const oldTaskDir = getTaskDir(taskId, currentStatus, this.cwdProvider);
        const newTaskDir = getTaskDir(taskId, newStatus, this.cwdProvider);
        
        await TaskFileUtils.ensureDir(newTaskDir);
        
        // Move subtasks directory if it exists
        const oldSubtasksDir = getSubtasksDir(taskId, currentStatus, this.cwdProvider);
        const newSubtasksDir = getSubtasksDir(taskId, newStatus, this.cwdProvider);
        
        if (await TaskFileUtils.dirExists(oldSubtasksDir)) {
          await fs.rename(oldSubtasksDir, newSubtasksDir);
        }
        
        // Write new task file
        task.status = newStatus;
        const newTaskFile = getTaskFile(taskId, newStatus, this.cwdProvider);
        await TaskFileUtils.writeTaskFile(newTaskFile, task);
        
        // Remove old directory
        await fs.rm(oldTaskDir, { recursive: true, force: true });
      } else {
        // Just update the file
        task.status = newStatus;
        const taskFile = getTaskFile(taskId, currentStatus, this.cwdProvider);
        await TaskFileUtils.writeTaskFile(taskFile, task);
      }

      return task;
    });
  }

  /**
   * Change task status
   */
  async changeTaskStatus(taskId: string, newStatus: TaskStatus): Promise<Task | null> {
    return this.withLock(async () => {
      // Find the task without calling getTask (which would cause deadlock)
      let task: Task | null = null;
      let currentStatus: TaskStatus | null = null;
      
      for (const status of ['open', 'in-progress', 'closed'] as TaskStatus[]) {
        task = await this.loadTaskFromFile(taskId, status);
        if (task) {
          currentStatus = status;
          break;
        }
      }

      if (!task || !currentStatus) return null;
      if (currentStatus === newStatus) return task;

      const oldTaskDir = getTaskDir(taskId, currentStatus, this.cwdProvider);
      const newTaskDir = getTaskDir(taskId, newStatus, this.cwdProvider);
      
      await TaskFileUtils.ensureDir(newTaskDir);
      
      // Move subtasks directory if it exists
      const oldSubtasksDir = getSubtasksDir(taskId, currentStatus, this.cwdProvider);
      const newSubtasksDir = getSubtasksDir(taskId, newStatus, this.cwdProvider);
      
      if (await TaskFileUtils.dirExists(oldSubtasksDir)) {
        await fs.rename(oldSubtasksDir, newSubtasksDir);
      }
      
      // Update status and write new task file
      task.status = newStatus;
      const newTaskFile = getTaskFile(taskId, newStatus, this.cwdProvider);
      await TaskFileUtils.writeTaskFile(newTaskFile, task);
      
      // Remove old directory
      await fs.rm(oldTaskDir, { recursive: true, force: true });

      return task;
    });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    return this.withLock(async () => {
      for (const status of ['open', 'in-progress', 'closed'] as TaskStatus[]) {
        const taskDir = getTaskDir(taskId, status, this.cwdProvider);
        
        if (await TaskFileUtils.dirExists(taskDir)) {
          await fs.rm(taskDir, { recursive: true, force: true });
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Assign a task to someone
   */
  async assignTask(taskId: string, assignee: string): Promise<Task | null> {
    return this.updateTask(taskId, { assignee });
  }

  /**
   * Unassign a task
   */
  async unassignTask(taskId: string): Promise<Task | null> {
    return this.updateTask(taskId, { assignee: undefined });
  }
}