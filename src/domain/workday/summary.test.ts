import { describe, expect, it } from 'vitest';
import type { Context, TimeSegment } from '../types';
import { calculateWorkdaySummary } from './summary';

const CONTEXT: Context = {
  id: 'ctx-work',
  name: 'Work',
  targetMinutesPerDay: 8 * 60,
  plannedLunchMinutes: 30,
  expectedFinishEnabled: true,
  archived: false,
};

const DAY_START = new Date(2026, 7, 24, 0, 0, 0, 0).getTime();
const NOW = new Date(2026, 7, 24, 10, 0, 0, 0).getTime();
const EIGHT_AM = new Date(2026, 7, 24, 8, 0, 0, 0).getTime();

function workSegment(startedAt: number, endedAt: number | null): TimeSegment {
  return {
    id: 'seg-work',
    contextId: CONTEXT.id,
    kind: 'work',
    startedAt,
    endedAt,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

describe('calculateWorkdaySummary', () => {
  it('reports idle status with zero worked time before tracking starts', () => {
    const summary = calculateWorkdaySummary({
      now: NOW,
      context: CONTEXT,
      segments: [],
    });

    expect(summary.status).toBe('idle');
    expect(summary.workedMs).toBe(0);
    expect(summary.openSegment).toBeNull();
  });

  it('reports working status and worked duration from open work', () => {
    const summary = calculateWorkdaySummary({
      now: NOW,
      context: CONTEXT,
      segments: [workSegment(EIGHT_AM, null)],
    });

    expect(summary.status).toBe('working');
    expect(summary.workedMs).toBe(2 * 60 * 60 * 1_000);
  });

  it('derives remaining work and expected finish from domain calculations', () => {
    const summary = calculateWorkdaySummary({
      now: NOW,
      context: CONTEXT,
      segments: [workSegment(EIGHT_AM, null)],
    });

    expect(summary.targetProgress.hasTarget).toBe(true);
    if (summary.targetProgress.hasTarget) {
      expect(summary.targetProgress.remainingMs).toBe(6 * 60 * 60 * 1_000);
    }
    expect(summary.expectedFinish).toBe(new Date(2026, 7, 24, 16, 30, 0, 0).getTime());
  });

  it('reflects historical start time in worked duration and expected finish', () => {
    const startedAt = NOW - 3 * 60 * 60 * 1_000;
    const summary = calculateWorkdaySummary({
      now: NOW,
      context: CONTEXT,
      segments: [workSegment(startedAt, null)],
    });

    expect(summary.workedMs).toBe(3 * 60 * 60 * 1_000);
    expect(summary.expectedFinish).toBe(new Date(2026, 7, 24, 15, 30, 0, 0).getTime());
  });
});
