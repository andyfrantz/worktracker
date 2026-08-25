import type { TimeSegment, WorkSegment } from '../types';
import { findOpenSegment } from '../time/transitions';
import { validateTimeline, type TimelineValidationError } from '../time/invariants';
import { calculateWorkSegmentDuration } from '../time/calculations';

/** Default gap after which reload/wake may warrant a user correction prompt. */
export const DEFAULT_SUSPICIOUS_GAP_MS = 45 * 60 * 1_000;

/** Default open-segment duration after which an overnight-style prompt may appear. */
export const DEFAULT_LONG_OPEN_SEGMENT_MS = 10 * 60 * 60 * 1_000;

export type SuspiciousInactivityReason = 'long_open_segment' | 'wall_clock_gap';

export interface WorkdayRecovery {
  /** Timeline facts are returned unchanged; open work continues through reload/sleep. */
  segments: readonly TimeSegment[];
  openSegment: TimeSegment | null;
  openSegmentDurationMs: number;
}

export interface SuspiciousInactivity {
  reason: SuspiciousInactivityReason;
  openSegmentId: string;
  openSegmentStartedAt: number;
  /** Elapsed wall-clock time relevant to the prompt. */
  elapsedMs: number;
  lastSeenAt?: number;
  suggestedBreakStartAt: number;
  suggestedBreakEndAt: number;
}

export interface DetectSuspiciousInactivityInput {
  segments: readonly TimeSegment[];
  now: number;
  lastSeenAt?: number;
  suspiciousGapMs?: number;
  longOpenSegmentMs?: number;
}

export interface ApplyInactivityCorrectionInput {
  openSegmentId: string;
  breakStartAt: number;
  breakEndAt: number;
  now: number;
  breakSegmentId: string;
  resumeWorkSegmentId: string;
  contextId: string;
  taskId?: string;
}

export type RecoveryErrorCode =
  | TimelineValidationError['code']
  | 'invalid_correction_range'
  | 'no_open_segment'
  | 'segment_not_found'
  | 'requires_open_work';

export interface RecoveryError {
  code: RecoveryErrorCode;
  message: string;
  segmentIds: string[];
}

export type RecoveryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RecoveryError };

function success<T>(value: T): RecoveryResult<T> {
  return { ok: true, value };
}

function failure(
  code: RecoveryErrorCode,
  message: string,
  segmentIds: string[],
): RecoveryResult<never> {
  return { ok: false, error: { code, message, segmentIds } };
}

function finalizeTimeline(segments: readonly TimeSegment[]): RecoveryResult<TimeSegment[]> {
  const validation = validateTimeline(segments);
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: validation.error.code,
        message: validation.error.message,
        segmentIds: validation.error.segmentIds,
      },
    };
  }

  return success([...segments]);
}

/** Recover workday state after reload or sleep without mutating timeline facts. */
export function recoverWorkdayState(
  segments: readonly TimeSegment[],
  now: number,
): WorkdayRecovery {
  const openSegment = findOpenSegment(segments) ?? null;

  return {
    segments,
    openSegment,
    openSegmentDurationMs: openSegment ? calculateWorkSegmentDuration(openSegment, now) : 0,
  };
}

/**
 * Detect suspicious wall-clock gaps or long open segments.
 * Detection is read-only and never rewrites history.
 */
export function detectSuspiciousInactivity(
  input: DetectSuspiciousInactivityInput,
): SuspiciousInactivity | null {
  const openSegment = findOpenSegment(input.segments);
  if (!openSegment) {
    return null;
  }

  const suspiciousGapMs = input.suspiciousGapMs ?? DEFAULT_SUSPICIOUS_GAP_MS;
  const longOpenSegmentMs = input.longOpenSegmentMs ?? DEFAULT_LONG_OPEN_SEGMENT_MS;
  const openDurationMs = input.now - openSegment.startedAt;

  if (input.lastSeenAt !== undefined) {
    const wallClockGapMs = input.now - input.lastSeenAt;
    if (wallClockGapMs >= suspiciousGapMs) {
      return {
        reason: 'wall_clock_gap',
        openSegmentId: openSegment.id,
        openSegmentStartedAt: openSegment.startedAt,
        elapsedMs: wallClockGapMs,
        lastSeenAt: input.lastSeenAt,
        suggestedBreakStartAt: input.lastSeenAt,
        suggestedBreakEndAt: input.now,
      };
    }
  }

  if (openDurationMs >= longOpenSegmentMs) {
    return {
      reason: 'long_open_segment',
      openSegmentId: openSegment.id,
      openSegmentStartedAt: openSegment.startedAt,
      elapsedMs: openDurationMs,
      suggestedBreakStartAt: openSegment.startedAt,
      suggestedBreakEndAt: input.now,
    };
  }

  return null;
}

/** Apply a user-approved correction that splits open work and marks inactivity as break. */
export function applyInactivityCorrection(
  segments: readonly TimeSegment[],
  input: ApplyInactivityCorrectionInput,
): RecoveryResult<TimeSegment[]> {
  const openSegment = findOpenSegment(segments);
  if (!openSegment) {
    return failure('no_open_segment', 'No open segment to correct.', []);
  }

  if (openSegment.id !== input.openSegmentId) {
    return failure(
      'segment_not_found',
      'Correction requires the currently open segment.',
      [openSegment.id],
    );
  }

  if (openSegment.kind !== 'work') {
    return failure(
      'requires_open_work',
      'Inactivity correction requires an open work segment.',
      [openSegment.id],
    );
  }

  if (
    input.breakStartAt <= openSegment.startedAt ||
    input.breakEndAt <= input.breakStartAt ||
    input.breakEndAt > input.now
  ) {
    return failure(
      'invalid_correction_range',
      'Break correction must fall inside the open work segment and not extend into the future.',
      [openSegment.id],
    );
  }

  if (
    segments.some(
      (segment) =>
        segment.id === input.breakSegmentId || segment.id === input.resumeWorkSegmentId,
    )
  ) {
    return failure('duplicate_id', 'Timeline segment IDs must be unique.', [
      input.breakSegmentId,
      input.resumeWorkSegmentId,
    ]);
  }

  const closedWork: WorkSegment = {
    ...openSegment,
    endedAt: input.breakStartAt,
    updatedAt: input.now,
  };

  const breakSegment: TimeSegment = {
    id: input.breakSegmentId,
    contextId: input.contextId,
    kind: 'break',
    startedAt: input.breakStartAt,
    endedAt: input.breakEndAt,
    createdAt: input.now,
    updatedAt: input.now,
  };

  const nextSegments: TimeSegment[] = [
    ...segments.filter((segment) => segment.id !== openSegment.id),
    closedWork,
    breakSegment,
  ];

  if (input.breakEndAt < input.now) {
    const resumedWork: WorkSegment = {
      id: input.resumeWorkSegmentId,
      contextId: input.contextId,
      kind: 'work',
      startedAt: input.breakEndAt,
      endedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      ...(input.taskId ? { taskId: input.taskId } : {}),
    };
    nextSegments.push(resumedWork);
  }

  return finalizeTimeline(nextSegments);
}
