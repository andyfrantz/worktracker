import type { SegmentKind, TimeSegment } from '../types';
import {
  insertSegment,
  updateSegment,
  validateTimeline,
  type SegmentPatch,
  type TimelineValidationError,
  type TimelineValidationResult,
} from './invariants';

export type CorrectionErrorCode =
  | TimelineValidationError['code']
  | 'invalid_split_point'
  | 'segments_not_adjacent'
  | 'segments_not_mergeable';

export interface CorrectionError {
  code: CorrectionErrorCode;
  message: string;
  segmentIds: string[];
}

export type CorrectionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CorrectionError };

export interface SplitSegmentInput {
  segmentId: string;
  at: number;
  secondSegmentId: string;
  now: number;
}

function success<T>(value: T): CorrectionResult<T> {
  return { ok: true, value };
}

function failure(
  code: CorrectionErrorCode,
  message: string,
  segmentIds: string[],
): CorrectionResult<never> {
  return { ok: false, error: { code, message, segmentIds } };
}

function fromTimelineResult<T>(result: TimelineValidationResult<T>): CorrectionResult<T> {
  if (result.ok) {
    return success(result.value);
  }

  return {
    ok: false,
    error: {
      code: result.error.code,
      message: result.error.message,
      segmentIds: result.error.segmentIds,
    },
  };
}

function finalizeTimeline(segments: readonly TimeSegment[]): CorrectionResult<TimeSegment[]> {
  const validation = validateTimeline(segments);
  if (!validation.ok) {
    return fromTimelineResult(validation);
  }

  return success([...segments]);
}

function findSegment(
  segments: readonly TimeSegment[],
  segmentId: string,
): TimeSegment | undefined {
  return segments.find((segment) => segment.id === segmentId);
}

function withUpdatedTimestamp(segment: TimeSegment, now: number): TimeSegment {
  return { ...segment, updatedAt: now };
}

function toSegmentKind(
  segment: TimeSegment,
  kind: SegmentKind,
  now: number,
  taskId?: string,
): TimeSegment {
  const base = {
    id: segment.id,
    contextId: segment.contextId,
    startedAt: segment.startedAt,
    endedAt: segment.endedAt,
    createdAt: segment.createdAt,
    updatedAt: now,
  };

  if (kind === 'work') {
    return {
      ...base,
      kind: 'work',
      ...(taskId ? { taskId } : {}),
    };
  }

  return {
    ...base,
    kind,
  };
}

function workTaskId(segment: TimeSegment): string | undefined {
  return segment.kind === 'work' ? segment.taskId : undefined;
}

function segmentsAreMergeable(left: TimeSegment, right: TimeSegment): boolean {
  if (left.contextId !== right.contextId || left.kind !== right.kind) {
    return false;
  }

  if (left.kind !== 'work') {
    return true;
  }

  return workTaskId(left) === workTaskId(right);
}

/** Edit a segment's start/end boundaries. */
export function editSegmentBoundaries(
  segments: readonly TimeSegment[],
  segmentId: string,
  patch: Pick<SegmentPatch, 'startedAt' | 'endedAt'>,
  now: number,
): CorrectionResult<TimeSegment[]> {
  const existing = findSegment(segments, segmentId);
  if (!existing) {
    return failure('segment_not_found', 'Segment not found.', [segmentId]);
  }

  const result = updateSegment(segments, segmentId, patch);
  if (!result.ok) {
    return fromTimelineResult(result);
  }

  return success(
    result.value.map((segment) =>
      segment.id === segmentId ? { ...segment, updatedAt: now } : segment,
    ),
  );
}

/** Insert a forgotten historical segment. */
export function insertForgottenSegment(
  segments: readonly TimeSegment[],
  segment: TimeSegment,
): CorrectionResult<TimeSegment[]> {
  return fromTimelineResult(insertSegment(segments, segment));
}

/** Change a segment kind, preserving boundaries and updating task attribution for work. */
export function changeSegmentKind(
  segments: readonly TimeSegment[],
  segmentId: string,
  kind: SegmentKind,
  now: number,
  taskId?: string,
): CorrectionResult<TimeSegment[]> {
  const existing = findSegment(segments, segmentId);
  if (!existing) {
    return failure('segment_not_found', 'Segment not found.', [segmentId]);
  }

  const next = segments.map((segment) =>
    segment.id === segmentId ? toSegmentKind(segment, kind, now, taskId) : segment,
  );

  return finalizeTimeline(next);
}

/** Delete an erroneous segment. */
export function deleteSegment(
  segments: readonly TimeSegment[],
  segmentId: string,
): CorrectionResult<TimeSegment[]> {
  const existing = findSegment(segments, segmentId);
  if (!existing) {
    return failure('segment_not_found', 'Segment not found.', [segmentId]);
  }

  return finalizeTimeline(segments.filter((segment) => segment.id !== segmentId));
}

/** Split one segment into two at the given instant. */
export function splitSegment(
  segments: readonly TimeSegment[],
  input: SplitSegmentInput,
): CorrectionResult<TimeSegment[]> {
  const original = findSegment(segments, input.segmentId);
  if (!original) {
    return failure('segment_not_found', 'Segment not found.', [input.segmentId]);
  }

  if (input.at <= original.startedAt) {
    return failure(
      'invalid_split_point',
      'Split point must be after the segment start.',
      [original.id],
    );
  }

  if (original.endedAt !== null && input.at >= original.endedAt) {
    return failure(
      'invalid_split_point',
      'Split point must be before the segment end.',
      [original.id],
    );
  }

  if (segments.some((segment) => segment.id === input.secondSegmentId)) {
    return failure('duplicate_id', 'Timeline segment IDs must be unique.', [input.secondSegmentId]);
  }

  const first = withUpdatedTimestamp(
    {
      ...original,
      endedAt: input.at,
    },
    input.now,
  );
  const second = toSegmentKind(
    {
      ...original,
      id: input.secondSegmentId,
      startedAt: input.at,
      endedAt: original.endedAt,
      createdAt: input.now,
    },
    original.kind,
    input.now,
    workTaskId(original),
  );

  const next = [
    ...segments.filter((segment) => segment.id !== input.segmentId),
    first,
    second,
  ];

  return finalizeTimeline(next);
}

/** Merge two compatible adjacent segments into one. */
export function mergeAdjacentSegments(
  segments: readonly TimeSegment[],
  firstSegmentId: string,
  secondSegmentId: string,
  now: number,
): CorrectionResult<TimeSegment[]> {
  const first = findSegment(segments, firstSegmentId);
  const second = findSegment(segments, secondSegmentId);

  if (!first || !second) {
    return failure('segment_not_found', 'Segment not found.', [
      firstSegmentId,
      secondSegmentId,
    ]);
  }

  const [left, right] =
    first.startedAt <= second.startedAt ? [first, second] : [second, first];

  if (left.endedAt !== right.startedAt) {
    return failure(
      'segments_not_adjacent',
      'Segments must touch at a shared boundary to merge.',
      [left.id, right.id],
    );
  }

  if (!segmentsAreMergeable(left, right)) {
    return failure(
      'segments_not_mergeable',
      'Adjacent segments must share context, kind, and work task attribution to merge.',
      [left.id, right.id],
    );
  }

  const merged = withUpdatedTimestamp(
    {
      ...left,
      endedAt: right.endedAt,
    },
    now,
  );

  const next = [
    ...segments.filter((segment) => segment.id !== left.id && segment.id !== right.id),
    merged,
  ];

  return finalizeTimeline(next);
}
