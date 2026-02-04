export type TaskStatus = 'open' | 'in-progress' | 'closed';

export interface TaskFrontmatter {
  title: string;
  assignee?: string; // Only present in in-progress or closed status
}

export interface Task {
  id: string;
  frontmatter: TaskFrontmatter;
  description: string;
  status: TaskStatus;
  subtasks?: Task[]; // Only one level deep
}

export interface CreateTaskOptions {
  title: string;
  description: string;
  assignee?: string;
  subtasks?: Array<{
    title: string;
    description: string;
  }>;
}

export interface UpdateTaskOptions {
  title?: string;
  description?: string;
  assignee?: string;
}

export interface TaskFilter {
  status?: TaskStatus;
  assignee?: string;
  hasSubtasks?: boolean;
}

export interface TaskManagerOptions {
  cwdProvider?: () => string;
}