import { describe, expect, it } from 'vitest';
import {
  parseTimeInputValue,
  startedAtFromLocalClock,
  startedAtMinutesAgo,
} from './historical-start';

const NOW = new Date(2026, 7, 24, 10, 0, 0, 0).getTime();

describe('historical start helpers', () => {
  it('derives start times from minutes ago', () => {
    expect(startedAtMinutesAgo(NOW, 15)).toBe(NOW - 15 * 60 * 1_000);
  });

  it('builds a local clock start time for earlier today', () => {
    expect(startedAtFromLocalClock(NOW, 8, 15)).toBe(new Date(2026, 7, 24, 8, 15, 0, 0).getTime());
  });

  it('rejects future local clock times', () => {
    expect(startedAtFromLocalClock(NOW, 11, 0)).toBeNull();
  });

  it('parses HTML time input values', () => {
    expect(parseTimeInputValue(NOW, '08:15')).toBe(new Date(2026, 7, 24, 8, 15, 0, 0).getTime());
    expect(parseTimeInputValue(NOW, 'invalid')).toBeNull();
  });
});
