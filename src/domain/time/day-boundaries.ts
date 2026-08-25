import type { ReportingPeriod } from '../time/period';

/** Local calendar day as half-open [startAt, endAt) in the user's timezone. */
export function localDayPeriod(now: number): ReportingPeriod {
  const date = new Date(now);
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startAt: start.getTime(),
    endAt: end.getTime(),
  };
}
