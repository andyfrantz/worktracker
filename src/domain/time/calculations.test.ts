import { describe, expect, it } from 'vitest';
import type { TimeSegment } from '../types';
import {
  calculateWorkedDuration,
  calculateWorkSegmentDuration,
  clipIntervalDuration,
} from './index';

const BASE = {
  contextId: 'ctx-work',
  createdAt: 0,
  updatedAt: 0,
} as const;

function workSegment(
  id: string,
  startedAt: number,
  endedAt: number | null,
  taskId?: string,
): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'work',
    startedAt,
    endedAt,
    ...(taskId ? { taskId } : {}),
  };
}

function breakSegment(id: string, startedAt: number, endedAt: number): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'break',
    startedAt,
    endedAt,
  };
}

function lunchSegment(id: string, startedAt: number, endedAt: number): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'lunch',
    startedAt,
    endedAt,
  };
}

describe('clipIntervalDuration', () => {
  it('returns the full interval when it lies inside the period', () => {
    expect(clipIntervalDuration(100, 400, 0, 1_000)).toBe(300);
  });

  it('clips the start and end at reporting boundaries', () => {
    expect(clipIntervalDuration(100, 500, 200, 400)).toBe(200);
  });

  it('returns zero when the interval is outside the period', () => {
    expect(clipIntervalDuration(100, 200, 300, 400)).toBe(0);
  });
});

describe('calculateWorkSegmentDuration', () => {
  it('returns duration for a closed work segment', () => {
    expect(calculateWorkSegmentDuration(workSegment('a', 100, 400), 500)).toBe(300);
  });

  it('uses now for an open work segment', () => {
    expect(calculateWorkSegmentDuration(workSegment('a', 100, null), 450)).toBe(350);
  });

  it('ignores break and lunch segments', () => {
    expect(calculateWorkSegmentDuration(breakSegment('a', 100, 400), 500)).toBe(0);
    expect(calculateWorkSegmentDuration(lunchSegment('a', 100, 400), 500)).toBe(0);
  });
});

describe('calculateWorkedDuration', () => {
  const period = { startAt: 0, endAt: 10_000 };

  it('returns zero when there is no work', () => {
    const segments = [breakSegment('break', 1_000, 2_000), lunchSegment('lunch', 3_000, 4_000)];

    expect(calculateWorkedDuration(segments, period, 5_000)).toBe(0);
  });

  it('sums closed work segments inside the period', () => {
    const segments = [
      workSegment('a', 1_000, 2_000, 'task-a'),
      workSegment('b', 3_000, 5_000, 'task-b'),
    ];

    expect(calculateWorkedDuration(segments, period, 6_000)).toBe(3_000);
  });

  it('includes unassigned work segments', () => {
    const segments = [workSegment('unassigned', 1_000, 2_500)];

    expect(calculateWorkedDuration(segments, period, 3_000)).toBe(1_500);
  });

  it('uses now for open work segments', () => {
    const segments = [workSegment('open', 8_000, null)];

    expect(calculateWorkedDuration(segments, period, 9_500)).toBe(1_500);
  });

  it('ignores break and lunch segments', () => {
    const segments = [
      workSegment('work', 1_000, 4_000),
      breakSegment('break', 4_000, 5_000),
      lunchSegment('lunch', 5_000, 6_000),
      workSegment('more-work', 6_000, 8_000),
    ];

    expect(calculateWorkedDuration(segments, period, 9_000)).toBe(5_000);
  });

  it('clips segments that extend beyond the reporting period', () => {
    const segments = [workSegment('work', 8_000, 12_000)];

    expect(calculateWorkedDuration(segments, period, 12_000)).toBe(2_000);
  });

  it('clips a midnight-crossing segment to each local-day boundary', () => {
    const mondayStart = Date.parse('2026-08-24T00:00:00+02:00');
    const tuesdayStart = Date.parse('2026-08-25T00:00:00+02:00');
    const segmentStart = Date.parse('2026-08-24T23:30:00+02:00');
    const segmentEnd = Date.parse('2026-08-25T00:45:00+02:00');

    const segments = [workSegment('night', segmentStart, segmentEnd)];

    expect(
      calculateWorkedDuration(segments, { startAt: mondayStart, endAt: tuesdayStart }, segmentEnd),
    ).toBe(30 * 60 * 1_000);

    expect(
      calculateWorkedDuration(
        segments,
        { startAt: tuesdayStart, endAt: tuesdayStart + 24 * 60 * 60 * 1_000 },
        segmentEnd,
      ),
    ).toBe(45 * 60 * 1_000);
  });
});
