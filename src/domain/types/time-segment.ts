export type SegmentKind = 'work' | 'break' | 'lunch';

/** Shared fields for canonical timeline segments. Timestamps are epoch milliseconds. */
export interface TimeSegmentBase {
  id: string;
  contextId: string;
  startedAt: number;
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface WorkSegment extends TimeSegmentBase {
  kind: 'work';
  /** Optional task attribution; unassigned work is valid first-class work. */
  taskId?: string;
}

export interface BreakSegment extends TimeSegmentBase {
  kind: 'break';
}

export interface LunchSegment extends TimeSegmentBase {
  kind: 'lunch';
}

/** Canonical tracked time fact. Only one segment may be open globally. */
export type TimeSegment = WorkSegment | BreakSegment | LunchSegment;
