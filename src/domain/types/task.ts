export type TaskStatus = 'open' | 'done' | 'archived';

/** Optional planning/activity record; actual time is derived from work segments. */
export interface Task {
  id: string;
  contextId: string;
  projectId?: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  initialEstimateMinutes?: number;
  currentEstimateMinutes?: number;
  createdAt: number;
  completedAt?: number;
}

/** Generic external resource attached to a task. */
export interface TaskLink {
  id: string;
  taskId: string;
  label?: string;
  url: string;
}
