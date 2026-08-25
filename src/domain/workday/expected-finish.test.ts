import { describe, expect, it } from 'vitest';
import {
  calculateExpectedFinish,
  calculateExpectedFutureLunchMs,
  type ExpectedFinishInput,
} from './expected-finish';

const TARGET_MINUTES = 8 * 60;
const PLANNED_LUNCH_MINUTES = 30;
const TWO_HOURS_MS = 2 * 60 * 60 * 1_000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1_000;
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1_000;

function at(hour: number, minute = 0): number {
  return Date.parse(
    `2026-08-24T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+02:00`,
  );
}

function baseInput(overrides: Partial<ExpectedFinishInput> = {}): ExpectedFinishInput {
  return {
    now: at(10, 0),
    workedMs: TWO_HOURS_MS,
    targetMinutesPerDay: TARGET_MINUTES,
    plannedLunchMinutes: PLANNED_LUNCH_MINUTES,
    lunchOccurred: false,
    skipPlannedLunch: false,
    ...overrides,
  };
}

describe('calculateExpectedFinish', () => {
  it('predicts 16:30 from 08:00 start assumptions at 10:00 with 2h worked', () => {
    const finish = calculateExpectedFinish(baseInput());

    expect(finish).toBe(at(16, 30));
  });

  it('accounts for ordinary breaks through wall-clock now only', () => {
    const beforeBreak = calculateExpectedFinish(baseInput());
    const afterBreak = calculateExpectedFinish(baseInput({ now: at(10, 10) }));

    expect(beforeBreak).toBe(at(16, 30));
    expect(afterBreak).toBe(at(16, 40));
  });

  it('adds no future lunch after a completed 42-minute lunch', () => {
    const finish = calculateExpectedFinish(
      baseInput({
        now: at(12, 42),
        workedMs: FOUR_HOURS_MS,
        lunchOccurred: true,
      }),
    );

    expect(calculateExpectedFutureLunchMs(baseInput({ lunchOccurred: true }))).toBe(0);
    expect(finish).toBe(at(16, 42));
  });

  it('finishes 10 minutes earlier after a 20-minute lunch than a 30-minute assumption', () => {
    const afterTwentyMinuteLunch = calculateExpectedFinish(
      baseInput({
        now: at(12, 20),
        workedMs: FOUR_HOURS_MS,
        lunchOccurred: true,
      }),
    );
    const afterThirtyMinuteLunch = calculateExpectedFinish(
      baseInput({
        now: at(12, 30),
        workedMs: FOUR_HOURS_MS,
        lunchOccurred: true,
      }),
    );

    expect(afterTwentyMinuteLunch).toBe(at(16, 20));
    expect(afterThirtyMinuteLunch).toBe(at(16, 30));
    expect(afterThirtyMinuteLunch! - afterTwentyMinuteLunch!).toBe(10 * 60 * 1_000);
  });

  it('omits planned lunch when skip planned lunch is enabled for today', () => {
    const finish = calculateExpectedFinish(baseInput({ skipPlannedLunch: true }));

    expect(calculateExpectedFutureLunchMs(baseInput({ skipPlannedLunch: true }))).toBe(0);
    expect(finish).toBe(at(16, 0));
  });

  it('returns now when overtime has been reached', () => {
    const now = at(17, 15);
    const finish = calculateExpectedFinish(
      baseInput({
        now,
        workedMs: EIGHT_HOURS_MS + 45 * 60 * 1_000,
      }),
    );

    expect(finish).toBe(now);
  });

  it('returns null for contexts without a target', () => {
    const finish = calculateExpectedFinish(
      baseInput({
        targetMinutesPerDay: undefined,
      }),
    );

    expect(finish).toBeNull();
  });

  it('reduces future lunch while lunch is active', () => {
    const futureLunch = calculateExpectedFutureLunchMs(
      baseInput({
        lunchActiveElapsedMs: 12 * 60 * 1_000,
      }),
    );

    expect(futureLunch).toBe(18 * 60 * 1_000);
  });
});
