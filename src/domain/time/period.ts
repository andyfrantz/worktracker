/** Duration in milliseconds for half-open [intervalStart, intervalEnd) clipped to [periodStart, periodEnd). */
export function clipIntervalDuration(
  intervalStart: number,
  intervalEnd: number,
  periodStart: number,
  periodEnd: number,
): number {
  const start = Math.max(intervalStart, periodStart);
  const end = Math.min(intervalEnd, periodEnd);
  return Math.max(0, end - start);
}

export interface ReportingPeriod {
  startAt: number;
  endAt: number;
}
