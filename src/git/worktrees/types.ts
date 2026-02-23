export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  dirty: boolean;
}

export interface CreateWorktreeOptions {
  detach?: boolean;
  force?: boolean;
}

export interface RemoveWorktreeOptions {
  force?: boolean;
}
