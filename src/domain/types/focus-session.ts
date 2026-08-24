export type FocusSessionStatus = 'running' | 'completed' | 'cancelled';

/** Optional focus/Pomodoro overlay; does not affect canonical work accounting. */
export interface FocusSession {
  id: string;
  contextId: string;
  taskId?: string;
  plannedMinutes: number;
  startedAt: number;
  endedAt: number | null;
  status: FocusSessionStatus;
}
