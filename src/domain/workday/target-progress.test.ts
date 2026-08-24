import { describe, expect, it } from 'vitest';
import { calculateTargetProgress } from './target-progress';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1_000;

describe('calculateTargetProgress', () => {
  it('returns no-target semantics when the context has no target', () => {
    const result = calculateTargetProgress(EIGHT_HOURS_MS);

    expect(result.hasTarget).toBe(false);
    if (!result.hasTarget) {
      expect(result.workedMs).toBe(EIGHT_HOURS_MS);
    }
  });

  it('returns full remaining work when nothing has been worked yet', () => {
    const result = calculateTargetProgress(0, 480);

    expect(result).toEqual({
      hasTarget: true,
      workedMs: 0,
      targetMs: EIGHT_HOURS_MS,
      remainingMs: EIGHT_HOURS_MS,
      overtimeMs: 0,
      targetReached: false,
    });
  });

  it('returns remaining work when under target', () => {
    const workedMs = 2 * 60 * 60 * 1_000;
    const result = calculateTargetProgress(workedMs, 480);

    expect(result.hasTarget).toBe(true);
    if (result.hasTarget) {
      expect(result.remainingMs).toBe(6 * 60 * 60 * 1_000);
      expect(result.overtimeMs).toBe(0);
      expect(result.targetReached).toBe(false);
    }
  });

  it('returns zero remaining and zero overtime when exactly at target', () => {
    const result = calculateTargetProgress(EIGHT_HOURS_MS, 480);

    expect(result.hasTarget).toBe(true);
    if (result.hasTarget) {
      expect(result.remainingMs).toBe(0);
      expect(result.overtimeMs).toBe(0);
      expect(result.targetReached).toBe(true);
    }
  });

  it('returns overtime when over target', () => {
    const workedMs = 9 * 60 * 60 * 1_000;
    const result = calculateTargetProgress(workedMs, 480);

    expect(result.hasTarget).toBe(true);
    if (result.hasTarget) {
      expect(result.remainingMs).toBe(0);
      expect(result.overtimeMs).toBe(1 * 60 * 60 * 1_000);
      expect(result.targetReached).toBe(true);
    }
  });
});
