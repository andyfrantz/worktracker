import type { Context, TimeSegment } from '../types';
import { calculateExpectedFinish } from './expected-finish';
import { calculateTargetProgress, type TargetProgressResult } from './target-progress';
import { calculateWorkedDuration } from '../time/calculations';
import { localDayPeriod } from '../time/day-boundaries';
import { segmentEndAt } from '../time/interval';
import type { ReportingPeriod } from '../time/period';

export type WorkdayStatus = 'idle' | 'working' | 'on-break' | 'at-lunch';

export interface WorkdaySummaryInput {
  now: number;
  context: Context;
  segments: readonly TimeSegment[];
  skipPlannedLunch?: boolean;
}

export interface WorkdaySummary {
  context: Context;
  status: WorkdayStatus;
  openSegment: TimeSegment | null;
  period: ReportingPeriod;
  workedMs: number;
  targetProgress: TargetProgressResult;
  expectedFinish: number | null;
  progressRatio: number | null;
}

function deriveStatus(openSegment: TimeSegment | null): WorkdayStatus {
  if (!openSegment) {
    return 'idle';
  }

  switch (openSegment.kind) {
    case 'work':
      return 'working';
    case 'break':
      return 'on-break';
    case 'lunch':
      return 'at-lunch';
  }
}

function segmentIntersectsPeriod(
  segment: TimeSegment,
  contextId: string,
  period: ReportingPeriod,
): boolean {
  return (
    segment.contextId === contextId &&
    segment.startedAt < period.endAt &&
    segmentEndAt(segment) > period.startAt
  );
}

function lunchOccurredToday(
  segments: readonly TimeSegment[],
  contextId: string,
  period: ReportingPeriod,
): boolean {
  return segments.some(
    (segment) =>
      segmentIntersectsPeriod(segment, contextId, period) &&
      segment.kind === 'lunch' &&
      segment.endedAt !== null,
  );
}

function lunchActiveElapsedMs(openSegment: TimeSegment | null, now: number): number | undefined {
  if (openSegment?.kind === 'lunch') {
    return now - openSegment.startedAt;
  }

  return undefined;
}

/** Derive the main workday screen summary from persisted facts plus now. */
export function calculateWorkdaySummary(input: WorkdaySummaryInput): WorkdaySummary {
  const period = localDayPeriod(input.now);
  const contextSegments = input.segments.filter((segment) => segment.contextId === input.context.id);
  const openSegment = contextSegments.find((segment) => segment.endedAt === null) ?? null;
  const workedMs = calculateWorkedDuration(contextSegments, period, input.now);
  const targetProgress = calculateTargetProgress(
    workedMs,
    input.context.targetMinutesPerDay,
  );
  const expectedFinish = calculateExpectedFinish({
    now: input.now,
    workedMs,
    targetMinutesPerDay: input.context.targetMinutesPerDay,
    plannedLunchMinutes: input.context.plannedLunchMinutes,
    lunchOccurred: lunchOccurredToday(contextSegments, input.context.id, period),
    lunchActiveElapsedMs: lunchActiveElapsedMs(openSegment, input.now),
    skipPlannedLunch: input.skipPlannedLunch,
  });

  const progressRatio =
    targetProgress.hasTarget && targetProgress.targetMs > 0
      ? workedMs / targetProgress.targetMs
      : null;

  return {
    context: input.context,
    status: deriveStatus(openSegment),
    openSegment,
    period,
    workedMs,
    targetProgress,
    expectedFinish,
    progressRatio,
  };
}
