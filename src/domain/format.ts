import type { WorkdayStatus } from './workday';

export function formatAppName(): string {
  return 'WorkTrack';
}

export function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatClockTime(instant: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));
}

export function formatWorkdayStatus(status: WorkdayStatus): string {
  switch (status) {
    case 'idle':
      return 'Not tracking';
    case 'working':
      return 'Working';
    case 'on-break':
      return 'On break';
    case 'at-lunch':
      return 'At lunch';
  }
}
