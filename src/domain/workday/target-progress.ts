const MS_PER_MINUTE = 60_000;

export interface TargetProgress {
  hasTarget: true;
  workedMs: number;
  targetMs: number;
  remainingMs: number;
  overtimeMs: number;
  targetReached: boolean;
}

export interface NoTargetProgress {
  hasTarget: false;
  workedMs: number;
}

export type TargetProgressResult = TargetProgress | NoTargetProgress;

function toTargetMs(targetMinutesPerDay: number): number {
  return targetMinutesPerDay * MS_PER_MINUTE;
}

/** Derive remaining work, overtime, and target-reached state from worked duration. */
export function calculateTargetProgress(
  workedMs: number,
  targetMinutesPerDay?: number,
): TargetProgressResult {
  if (targetMinutesPerDay == null) {
    return {
      hasTarget: false,
      workedMs,
    };
  }

  const targetMs = toTargetMs(targetMinutesPerDay);
  const remainingMs = Math.max(0, targetMs - workedMs);
  const overtimeMs = Math.max(0, workedMs - targetMs);

  return {
    hasTarget: true,
    workedMs,
    targetMs,
    remainingMs,
    overtimeMs,
    targetReached: workedMs >= targetMs,
  };
}
