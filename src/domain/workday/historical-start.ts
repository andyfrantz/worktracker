/** Common quick presets for starting work in the past. */
export const HISTORICAL_START_PRESET_MINUTES = [5, 10, 15, 30] as const;

export type HistoricalStartPresetMinutes = (typeof HISTORICAL_START_PRESET_MINUTES)[number];

/** Derive a historical start instant from minutes before now. */
export function startedAtMinutesAgo(now: number, minutesAgo: number): number {
  return now - minutesAgo * 60_000;
}

/** Build today's local start time from clock hours and minutes. Returns null when in the future. */
export function startedAtFromLocalClock(
  now: number,
  hours: number,
  minutes: number,
): number | null {
  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);

  if (candidate.getTime() >= now) {
    return null;
  }

  return candidate.getTime();
}

/** Parse an HTML time input value (HH:MM) into a historical start instant for today. */
export function parseTimeInputValue(now: number, value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  return startedAtFromLocalClock(now, hours, minutes);
}
