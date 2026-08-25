import { describe, expect, it } from 'vitest';
import type { TimeSegment } from '../types';
import { calculateWorkedDuration } from '../time/calculations';
import {
  applyInactivityCorrection,
  detectSuspiciousInactivity,
  recoverWorkdayState,
} from './recovery';

const CONTEXT_ID = 'ctx-work';
const DAY_START = 1_700_000_000_000;
const DAY_END = DAY_START + 24 * 60 * 60 * 1_000;

const BASE = {
  contextId: CONTEXT_ID,
  createdAt: DAY_START,
  updatedAt: DAY_START,
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

describe('recoverWorkdayState', () => {
  it('keeps an open work segment unchanged through reload/sleep', () => {
    const startedAt = DAY_START + 8 * 60 * 60 * 1_000;
    const now = startedAt + 3 * 60 * 60 * 1_000;
    const segments = [workSegment('open-work', startedAt, null, 'task-1')];

    const recovery = recoverWorkdayState(segments, now);

    expect(recovery.segments).toBe(segments);
    expect(recovery.openSegment).toMatchObject({
      id: 'open-work',
      kind: 'work',
      endedAt: null,
    });
    expect(recovery.openSegmentDurationMs).toBe(3 * 60 * 60 * 1_000);
  });

  it('counts sleep time as work by default while the segment remains open', () => {
    const startedAt = DAY_START + 8 * 60 * 60 * 1_000;
    const beforeSleep = startedAt + 2 * 60 * 60 * 1_000;
    const afterSleep = beforeSleep + 47 * 60 * 1_000;
    const segments = [workSegment('open-work', startedAt, null)];

    const workedAfterSleep = calculateWorkedDuration(
      segments,
      { startAt: DAY_START, endAt: DAY_END },
      afterSleep,
    );

    expect(workedAfterSleep).toBe(afterSleep - startedAt);
  });
});

describe('detectSuspiciousInactivity', () => {
  it('does not mutate timeline data', () => {
    const lastSeenAt = DAY_START + 10 * 60 * 60 * 1_000;
    const now = lastSeenAt + 47 * 60 * 1_000;
    const segments = [workSegment('open-work', DAY_START + 8 * 60 * 60 * 1_000, null)];
    const snapshot = structuredClone(segments);

    detectSuspiciousInactivity({ segments, now, lastSeenAt });

    expect(segments).toEqual(snapshot);
  });

  it('detects a suspicious wall-clock gap while work remains open', () => {
    const lastSeenAt = DAY_START + 10 * 60 * 60 * 1_000;
    const now = lastSeenAt + 47 * 60 * 1_000;
    const segments = [workSegment('open-work', DAY_START + 8 * 60 * 60 * 1_000, null)];

    const detection = detectSuspiciousInactivity({ segments, now, lastSeenAt });

    expect(detection).toMatchObject({
      reason: 'wall_clock_gap',
      openSegmentId: 'open-work',
      elapsedMs: 47 * 60 * 1_000,
      suggestedBreakStartAt: lastSeenAt,
      suggestedBreakEndAt: now,
    });
  });

  it('detects an overnight-style long open segment', () => {
    const startedAt = DAY_START + 8 * 60 * 60 * 1_000;
    const now = startedAt + 11 * 60 * 60 * 1_000;
    const segments = [workSegment('open-work', startedAt, null)];

    const detection = detectSuspiciousInactivity({ segments, now });

    expect(detection).toMatchObject({
      reason: 'long_open_segment',
      openSegmentId: 'open-work',
      elapsedMs: 11 * 60 * 60 * 1_000,
    });
  });

  it('returns null when there is nothing suspicious', () => {
    const startedAt = DAY_START + 8 * 60 * 60 * 1_000;
    const now = startedAt + 2 * 60 * 60 * 1_000;
    const segments = [workSegment('open-work', startedAt, null)];

    expect(
      detectSuspiciousInactivity({
        segments,
        now,
        lastSeenAt: now - 5 * 60 * 1_000,
      }),
    ).toBeNull();
  });
});

describe('applyInactivityCorrection', () => {
  it('splits open work and marks the inactive interval as break after approval', () => {
    const startedAt = DAY_START + 8 * 60 * 60 * 1_000;
    const breakStartAt = DAY_START + 10 * 60 * 60 * 1_000;
    const breakEndAt = breakStartAt + 47 * 60 * 1_000;
    const now = breakEndAt + 13 * 60 * 1_000;
    const segments = [workSegment('open-work', startedAt, null, 'task-1')];

    const before = calculateWorkedDuration(
      segments,
      { startAt: DAY_START, endAt: DAY_END },
      now,
    );

    const result = applyInactivityCorrection(segments, {
      openSegmentId: 'open-work',
      breakStartAt,
      breakEndAt,
      now,
      breakSegmentId: 'sleep-break',
      resumeWorkSegmentId: 'resumed-work',
      contextId: CONTEXT_ID,
      taskId: 'task-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = calculateWorkedDuration(
      result.value,
      { startAt: DAY_START, endAt: DAY_END },
      now,
    );

    expect(after).toBeLessThan(before);
    expect(after).toBe(breakStartAt - startedAt + (now - breakEndAt));
    expect(result.value.find((segment) => segment.id === 'sleep-break')).toMatchObject({
      kind: 'break',
      startedAt: breakStartAt,
      endedAt: breakEndAt,
    });
    expect(result.value.find((segment) => segment.id === 'resumed-work')).toMatchObject({
      kind: 'work',
      startedAt: breakEndAt,
      endedAt: null,
      taskId: 'task-1',
    });
  });

  it('rejects invalid correction ranges', () => {
    const startedAt = DAY_START + 8 * 60 * 60 * 1_000;
    const segments = [workSegment('open-work', startedAt, null)];

    const result = applyInactivityCorrection(segments, {
      openSegmentId: 'open-work',
      breakStartAt: startedAt,
      breakEndAt: startedAt + 30 * 60 * 1_000,
      now: startedAt + 60 * 60 * 1_000,
      breakSegmentId: 'break',
      resumeWorkSegmentId: 'work',
      contextId: CONTEXT_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_correction_range');
    }
  });
});
