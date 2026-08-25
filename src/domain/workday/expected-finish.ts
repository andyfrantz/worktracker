import { calculateTargetProgress } from './target-progress';

const MS_PER_MINUTE = 60_000;

export interface ExpectedFinishInput {
  now: number;
  workedMs: number;
  targetMinutesPerDay?: number;
  plannedLunchMinutes?: number;
  /** True once any lunch segment has completed for the relevant workday. */
  lunchOccurred: boolean;
  /** Elapsed time in the currently active lunch segment, if any. */
  lunchActiveElapsedMs?: number;
  /** Day-specific override that removes planned lunch from prediction only. */
  skipPlannedLunch?: boolean;
}

function expectedFutureLunchMsFromInput(input: ExpectedFinishInput): number {
  if (input.skipPlannedLunch) {
    return 0;
  }

  if (input.lunchOccurred) {
    return 0;
  }

  const plannedMs = (input.plannedLunchMinutes ?? 0) * MS_PER_MINUTE;
  const elapsedMs = input.lunchActiveElapsedMs ?? 0;
  return Math.max(0, plannedMs - elapsedMs);
}

/**
 * Derive expected finish from remaining work and still-expected future lunch.
 * Returns null when the context has no target, or `now` once the target is reached.
 */
export function calculateExpectedFinish(input: ExpectedFinishInput): number | null {
  const progress = calculateTargetProgress(input.workedMs, input.targetMinutesPerDay);
  if (!progress.hasTarget) {
    return null;
  }

  if (progress.remainingMs === 0) {
    return input.now;
  }

  return input.now + progress.remainingMs + expectedFutureLunchMsFromInput(input);
}

/** Exposed for tests and UI that need to show the lunch assumption separately. */
export function calculateExpectedFutureLunchMs(input: ExpectedFinishInput): number {
  const progress = calculateTargetProgress(input.workedMs, input.targetMinutesPerDay);
  if (!progress.hasTarget || progress.remainingMs === 0) {
    return 0;
  }

  return expectedFutureLunchMsFromInput(input);
}
