import type { TimeSegment } from '../types';
import { clipIntervalDuration, type ReportingPeriod } from './period';

function effectiveWorkSegmentEnd(segment: TimeSegment, now: number): number {
  return segment.endedAt ?? now;
}

function workSegmentDurationInPeriod(
  segment: TimeSegment,
  period: ReportingPeriod,
  now: number,
): number {
  if (segment.kind !== 'work') {
    return 0;
  }

  return clipIntervalDuration(
    segment.startedAt,
    effectiveWorkSegmentEnd(segment, now),
    period.startAt,
    period.endAt,
  );
}

/** Sum worked duration from work segments intersecting the reporting period. */
export function calculateWorkedDuration(
  segments: readonly TimeSegment[],
  period: ReportingPeriod,
  now: number,
): number {
  return segments.reduce(
    (total, segment) => total + workSegmentDurationInPeriod(segment, period, now),
    0,
  );
}

/** Full worked duration for one work segment without period clipping. */
export function calculateWorkSegmentDuration(segment: TimeSegment, now: number): number {
  if (segment.kind !== 'work') {
    return 0;
  }

  return Math.max(0, effectiveWorkSegmentEnd(segment, now) - segment.startedAt);
}
