import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { TaskManager } from '../manager.js';
import { TaskFileUtils } from '../file-utils.js';
import { getTasksDir, getTaskLockFile } from '../../paths.js';

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = `/tmp/orchid-test-${Date.now()}`;
    taskManager = new TaskManager({
      cwdProvider: () => testDir,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createTask', () => {
    it('should create an open task', async () => {
      const task = await taskManager.createTask({
        title: 'Test Task',
        description: 'This is a test task',
      });

      expect(task.id).toBeDefined();
      expect(task.frontmatter.title).toBe('Test Task');
      expect(task.description).toBe('This is a test task');
      expect(task.status).toBe('open');
      expect(task.frontmatter.assignee).toBeUndefined();
      expect(task.subtasks).toEqual([]);
    });

    it('should create an in-progress task with assignee', async () => {
      const task = await taskManager.createTask({
        title: 'Assigned Task',
        description: 'This task is assigned',
        assignee: 'john.doe',
      });

      expect(task.status).toBe('in-progress');
      expect(task.frontmatter.assignee).toBe('john.doe');
    });

    it('should create a task with subtasks', async () => {
      const task = await taskManager.createTask({
        title: 'Parent Task',
        description: 'Task with subtasks',
        subtasks: [
          {
            title: 'Subtask 1',
            description: 'First subtask',
          },
          {
            title: 'Subtask 2',
            description: 'Second subtask',
          },
        ],
      });

      expect(task.subtasks).toHaveLength(2);
      expect(task.subtasks![0].frontmatter.title).toBe('Subtask 1');
      expect(task.subtasks![0].status).toBe('open');
      expect(task.subtasks![1].frontmatter.title).toBe('Subtask 2');
    });
  });

  describe('getTask', () => {
    it('should retrieve a created task', async () => {
      const created = await taskManager.createTask({
        title: 'Test Task',
        description: 'This is a test task',
      });

      const retrieved = await taskManager.getTask(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.frontmatter.title).toBe('Test Task');
    });

    it('should return null for non-existent task', async () => {
      const task = await taskManager.getTask('non-existent-id');
      expect(task).toBeNull();
    });
  });

  describe('listTasks', () => {
    it('should list all tasks', async () => {
      await taskManager.createTask({
        title: 'Task 1',
        description: 'First task',
      });

      await taskManager.createTask({
        title: 'Task 2',
        description: 'Second task',
        assignee: 'john.doe',
      });

      const tasks = await taskManager.listTasks();
      expect(tasks).toHaveLength(2);
    });

    it('should filter tasks by status', async () => {
      await taskManager.createTask({
        title: 'Open Task',
        description: 'Open task',
      });

      await taskManager.createTask({
        title: 'Assigned Task',
        description: 'Assigned task',
        assignee: 'john.doe',
      });

      const openTasks = await taskManager.listTasks({ status: 'open' });
      const inProgressTasks = await taskManager.listTasks({ status: 'in-progress' });

      expect(openTasks).toHaveLength(1);
      expect(openTasks[0].frontmatter.title).toBe('Open Task');
      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].frontmatter.title).toBe('Assigned Task');
    });

    it('should filter tasks by assignee', async () => {
      await taskManager.createTask({
        title: 'Task 1',
        description: 'Task for John',
        assignee: 'john.doe',
      });

      await taskManager.createTask({
        title: 'Task 2',
        description: 'Task for Jane',
        assignee: 'jane.doe',
      });

      const johnsTasks = await taskManager.listTasks({ assignee: 'john.doe' });
      expect(johnsTasks).toHaveLength(1);
      expect(johnsTasks[0].frontmatter.title).toBe('Task 1');
    });

    it('should filter tasks by subtask presence', async () => {
      await taskManager.createTask({
        title: 'Simple Task',
        description: 'No subtasks',
      });

      await taskManager.createTask({
        title: 'Complex Task',
        description: 'With subtasks',
        subtasks: [{ title: 'Subtask', description: 'A subtask' }],
      });

      const withSubtasks = await taskManager.listTasks({ hasSubtasks: true });
      const withoutSubtasks = await taskManager.listTasks({ hasSubtasks: false });

      expect(withSubtasks).toHaveLength(1);
      expect(withoutSubtasks).toHaveLength(1);
    });
  });

  describe('updateTask', () => {
    it('should update task title and description', async () => {
      const task = await taskManager.createTask({
        title: 'Original Title',
        description: 'Original description',
      });

      const updated = await taskManager.updateTask(task.id, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(updated).toBeDefined();
      expect(updated!.frontmatter.title).toBe('Updated Title');
      expect(updated!.description).toBe('Updated description');
    });

    it('should assign task and change status', async () => {
      const task = await taskManager.createTask({
        title: 'Open Task',
        description: 'Task to assign',
      });

      const updated = await taskManager.updateTask(task.id, {
        assignee: 'john.doe',
      });

      expect(updated!.status).toBe('in-progress');
      expect(updated!.frontmatter.assignee).toBe('john.doe');
    });

    it('should unassign task and change status to open', async () => {
      const task = await taskManager.createTask({
        title: 'Assigned Task',
        description: 'Task to unassign',
        assignee: 'john.doe',
      });

      const updated = await taskManager.updateTask(task.id, {
        assignee: undefined,
      });

      expect(updated!.status).toBe('open');
      expect(updated!.frontmatter.assignee).toBeUndefined();
    });

    it('should return null for non-existent task', async () => {
      const updated = await taskManager.updateTask('non-existent-id', {
        title: 'New Title',
      });
      expect(updated).toBeNull();
    });
  });

  describe('changeTaskStatus', () => {
    it('should change task status', async () => {
      const task = await taskManager.createTask({
        title: 'Test Task',
        description: 'Task to change status',
      });

      const updated = await taskManager.changeTaskStatus(task.id, 'closed');
      expect(updated!.status).toBe('closed');
    });

    it('should return null for non-existent task', async () => {
      const updated = await taskManager.changeTaskStatus('non-existent-id', 'closed');
      expect(updated).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const task = await taskManager.createTask({
        title: 'Task to Delete',
        description: 'This task will be deleted',
      });

      const deleted = await taskManager.deleteTask(task.id);
      expect(deleted).toBe(true);

      const retrieved = await taskManager.getTask(task.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent task', async () => {
      const deleted = await taskManager.deleteTask('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('assignTask and unassignTask', () => {
    it('should assign and unassign tasks', async () => {
      const task = await taskManager.createTask({
        title: 'Test Task',
        description: 'Task for assignment',
      });

      const assigned = await taskManager.assignTask(task.id, 'john.doe');
      expect(assigned!.status).toBe('in-progress');
      expect(assigned!.frontmatter.assignee).toBe('john.doe');

      const unassigned = await taskManager.unassignTask(task.id);
      expect(unassigned!.status).toBe('open');
      expect(unassigned!.frontmatter.assignee).toBeUndefined();
    });
  });
});

describe('TaskFileUtils', () => {
  describe('parseTaskContent', () => {
    it('should parse task content with frontmatter', () => {
      const content = `---
title: "Test Task"
assignee: "john.doe"
---
This is the task description.`;

      const result = TaskFileUtils.parseTaskContent(content);
      
      expect(result.frontmatter.title).toBe('Test Task');
      expect(result.frontmatter.assignee).toBe('john.doe');
      expect(result.description).toBe('This is the task description.');
    });

    it('should handle missing assignee', () => {
      const content = `---
title: "Simple Task"
---
Simple task description.`;

      const result = TaskFileUtils.parseTaskContent(content);
      
      expect(result.frontmatter.title).toBe('Simple Task');
      expect(result.frontmatter.assignee).toBeUndefined();
      expect(result.description).toBe('Simple task description.');
    });

    it('should throw error for missing frontmatter', () => {
      const content = 'No frontmatter here';
      
      expect(() => TaskFileUtils.parseTaskContent(content)).toThrow('Invalid task file format');
    });
  });

  describe('taskToFileString', () => {
    it('should convert task to task file string', () => {
      const task = {
        id: 'test-id',
        frontmatter: {
          title: 'Test Task',
          assignee: 'john.doe',
        },
        description: 'Task description',
        status: 'in-progress' as const,
      };

      const taskString = TaskFileUtils.taskToFileString(task);
      
      expect(taskString).toContain('title: "Test Task"');
      expect(taskString).toContain('assignee: "john.doe"');
      expect(taskString).toContain('Task description');
    });

    it('should handle task without assignee', () => {
      const task = {
        id: 'test-id',
        frontmatter: {
          title: 'Simple Task',
        },
        description: 'Simple description',
        status: 'open' as const,
      };

      const taskString = TaskFileUtils.taskToFileString(task);
      
      expect(taskString).toContain('title: "Simple Task"');
      expect(taskString).not.toContain('assignee:');
      expect(taskString).toContain('Simple description');
    });
  });

  describe('generateTaskId', () => {
    it('should generate unique UUIDs', () => {
      const id1 = TaskFileUtils.generateTaskId();
      const id2 = TaskFileUtils.generateTaskId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });
});