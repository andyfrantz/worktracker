import type { TimeSegment, WorkSegment } from '../types';
import { validateTimeline, type TimelineValidationError } from './invariants';

export type TransitionErrorCode =
  | 'already_tracking'
  | 'invalid_started_at'
  | 'invalid_transition'
  | 'no_open_segment'
  | TimelineValidationError['code'];

export interface TransitionError {
  code: TransitionErrorCode;
  message: string;
  segmentIds: string[];
}

export type TransitionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: TransitionError };

export interface StartWorkInput {
  contextId: string;
  segmentId: string;
  startedAt: number;
  now: number;
  taskId?: string;
}

export interface TransitionInput {
  now: number;
  openSegmentId: string;
  nextSegmentId: string;
  contextId: string;
  taskId?: string;
}

function success<T>(value: T): TransitionResult<T> {
  return { ok: true, value };
}

function failure(
  code: TransitionErrorCode,
  message: string,
  segmentIds: string[],
): TransitionResult<never> {
  return { ok: false, error: { code, message, segmentIds } };
}

function fromTimelineError(error: TimelineValidationError): TransitionResult<never> {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      segmentIds: error.segmentIds,
    },
  };
}

function finalizeTimeline(segments: readonly TimeSegment[]): TransitionResult<TimeSegment[]> {
  const validation = validateTimeline(segments);
  if (!validation.ok) {
    return fromTimelineError(validation.error);
  }

  return success([...segments]);
}

export function findOpenSegment(segments: readonly TimeSegment[]): TimeSegment | undefined {
  return segments.find((segment) => segment.endedAt === null);
}

function findPreviousTaskId(
  segments: readonly TimeSegment[],
  contextId: string,
  before: number,
): string | undefined {
  const priorWork = segments
    .filter(
      (segment): segment is WorkSegment =>
        segment.kind === 'work' && segment.contextId === contextId && segment.startedAt < before,
    )
    .sort((left, right) => right.startedAt - left.startedAt)[0];

  return priorWork?.taskId;
}

function createWorkSegment(input: {
  id: string;
  contextId: string;
  startedAt: number;
  now: number;
  taskId?: string;
}): WorkSegment {
  return {
    id: input.id,
    contextId: input.contextId,
    kind: 'work',
    startedAt: input.startedAt,
    endedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
    ...(input.taskId ? { taskId: input.taskId } : {}),
  };
}

function createBreakSegment(input: {
  id: string;
  contextId: string;
  startedAt: number;
  now: number;
}): TimeSegment {
  return {
    id: input.id,
    contextId: input.contextId,
    kind: 'break',
    startedAt: input.startedAt,
    endedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function createLunchSegment(input: {
  id: string;
  contextId: string;
  startedAt: number;
  now: number;
}): TimeSegment {
  return {
    id: input.id,
    contextId: input.contextId,
    kind: 'lunch',
    startedAt: input.startedAt,
    endedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function closeOpenSegmentAt(
  segments: readonly TimeSegment[],
  openSegment: TimeSegment,
  at: number,
  now: number,
): TransitionResult<TimeSegment[]> {
  if (at <= openSegment.startedAt) {
    return failure(
      'invalid_transition',
      'Transition timestamp must be after the open segment start.',
      [openSegment.id],
    );
  }

  return success(
    segments.map((segment) =>
      segment.id === openSegment.id ? { ...segment, endedAt: at, updatedAt: now } : segment,
    ),
  );
}

function transitionOpenSegment(
  segments: readonly TimeSegment[],
  openSegment: TimeSegment,
  at: number,
  now: number,
  nextSegment?: TimeSegment,
): TransitionResult<TimeSegment[]> {
  const closed = closeOpenSegmentAt(segments, openSegment, at, now);
  if (!closed.ok) {
    return closed;
  }

  const next = nextSegment ? [...closed.value, nextSegment] : closed.value;
  return finalizeTimeline(next);
}

/** Start work now or at a supplied historical instant. */
export function startWork(
  segments: readonly TimeSegment[],
  input: StartWorkInput,
): TransitionResult<TimeSegment[]> {
  const openSegment = findOpenSegment(segments);
  if (openSegment) {
    return failure(
      'already_tracking',
      'Cannot start work while another segment is already open.',
      [openSegment.id],
    );
  }

  if (input.startedAt > input.now) {
    return failure(
      'invalid_started_at',
      'Work cannot start in the future.',
      [input.segmentId],
    );
  }

  const next = [
    ...segments,
    createWorkSegment({
      id: input.segmentId,
      contextId: input.contextId,
      startedAt: input.startedAt,
      now: input.now,
      taskId: input.taskId,
    }),
  ];

  return finalizeTimeline(next);
}

/** Pause open work by closing it and opening a break at the same timestamp. */
export function pauseWork(
  segments: readonly TimeSegment[],
  input: TransitionInput,
): TransitionResult<TimeSegment[]> {
  const openSegment = findOpenSegment(segments);
  if (!openSegment) {
    return failure('no_open_segment', 'No open segment to pause.', []);
  }

  if (openSegment.id !== input.openSegmentId || openSegment.kind !== 'work') {
    return failure(
      'invalid_transition',
      'Pause requires an open work segment.',
      [openSegment.id],
    );
  }

  return transitionOpenSegment(
    segments,
    openSegment,
    input.now,
    input.now,
    createBreakSegment({
      id: input.nextSegmentId,
      contextId: input.contextId,
      startedAt: input.now,
      now: input.now,
    }),
  );
}

/** Resume open break or lunch by closing it and opening work at the same timestamp. */
export function resumeWork(
  segments: readonly TimeSegment[],
  input: TransitionInput,
): TransitionResult<TimeSegment[]> {
  const openSegment = findOpenSegment(segments);
  if (!openSegment) {
    return failure('no_open_segment', 'No open segment to resume.', []);
  }

  if (
    openSegment.id !== input.openSegmentId ||
    (openSegment.kind !== 'break' && openSegment.kind !== 'lunch')
  ) {
    return failure(
      'invalid_transition',
      'Resume requires an open break or lunch segment.',
      [openSegment.id],
    );
  }

  const taskId =
    input.taskId ?? findPreviousTaskId(segments, input.contextId, input.now);

  return transitionOpenSegment(
    segments,
    openSegment,
    input.now,
    input.now,
    createWorkSegment({
      id: input.nextSegmentId,
      contextId: input.contextId,
      startedAt: input.now,
      now: input.now,
      taskId,
    }),
  );
}

/** Start lunch by closing open work and opening lunch at the same timestamp. */
export function startLunch(
  segments: readonly TimeSegment[],
  input: TransitionInput,
): TransitionResult<TimeSegment[]> {
  const openSegment = findOpenSegment(segments);
  if (!openSegment) {
    return failure('no_open_segment', 'No open segment to start lunch from.', []);
  }

  if (openSegment.id !== input.openSegmentId || openSegment.kind !== 'work') {
    return failure(
      'invalid_transition',
      'Lunch requires an open work segment.',
      [openSegment.id],
    );
  }

  return transitionOpenSegment(
    segments,
    openSegment,
    input.now,
    input.now,
    createLunchSegment({
      id: input.nextSegmentId,
      contextId: input.contextId,
      startedAt: input.now,
      now: input.now,
    }),
  );
}

/** Stop the workday by closing the open segment without opening another. */
export function stopWorkday(
  segments: readonly TimeSegment[],
  input: Pick<TransitionInput, 'now' | 'openSegmentId'>,
): TransitionResult<TimeSegment[]> {
  const openSegment = findOpenSegment(segments);
  if (!openSegment) {
    return failure('no_open_segment', 'No open segment to stop.', []);
  }

  if (openSegment.id !== input.openSegmentId) {
    return failure(
      'invalid_transition',
      'Stop requires the currently open segment.',
      [openSegment.id],
    );
  }

  return transitionOpenSegment(segments, openSegment, input.now, input.now);
}
