import type { Context } from '../../domain/types';

/** Stable ID for the seeded first-run Work context. */
export const DEFAULT_WORK_CONTEXT_ID = 'ctx-work';

export const DEFAULT_WORK_TARGET_MINUTES = 8 * 60;
export const DEFAULT_WORK_LUNCH_MINUTES = 30;

export const DEFAULT_WORK_CONTEXT: Context = {
  id: DEFAULT_WORK_CONTEXT_ID,
  name: 'Work',
  targetMinutesPerDay: DEFAULT_WORK_TARGET_MINUTES,
  plannedLunchMinutes: DEFAULT_WORK_LUNCH_MINUTES,
  expectedFinishEnabled: true,
  archived: false,
};

/**
 * Personal is intentionally not seeded on first run.
 * WorkTrack only needs Work to be immediately useful; users can add Personal later
 * from context management when they want a separate targetless mode.
 */
