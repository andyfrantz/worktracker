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

const DAY_START = Date.parse('2026-08-24T00:00:00+02:00');
const NOW = DAY_START + 10 * 60 * 60 * 1_000;

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
      segments: [workSegment(DAY_START + 8 * 60 * 60 * 1_000, null)],
    });

    expect(summary.status).toBe('working');
    expect(summary.workedMs).toBe(2 * 60 * 60 * 1_000);
  });

  it('derives remaining work and expected finish from domain calculations', () => {
    const summary = calculateWorkdaySummary({
      now: NOW,
      context: CONTEXT,
      segments: [workSegment(DAY_START + 8 * 60 * 60 * 1_000, null)],
    });

    expect(summary.targetProgress.hasTarget).toBe(true);
    if (summary.targetProgress.hasTarget) {
      expect(summary.targetProgress.remainingMs).toBe(6 * 60 * 60 * 1_000);
    }
    expect(summary.expectedFinish).toBe(DAY_START + 16.5 * 60 * 60 * 1_000);
  });
});
