import type { TimeSegment, TimeSegmentBase } from '../types';
import { segmentsOverlap } from './interval';

export type TimelineValidationCode =
  | 'duplicate_id'
  | 'invalid_closed_duration'
  | 'multiple_open_segments'
  | 'overlap'
  | 'segment_not_found';

export interface TimelineValidationError {
  code: TimelineValidationCode;
  message: string;
  segmentIds: string[];
}

export type TimelineValidationResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: TimelineValidationError };

export type SegmentPatch = Partial<
  Pick<TimeSegmentBase, 'startedAt' | 'endedAt'> & { kind: TimeSegment['kind']; taskId?: string }
>;

function success<T>(value: T): TimelineValidationResult<T> {
  return { ok: true, value };
}

function failure(
  code: TimelineValidationCode,
  message: string,
  segmentIds: string[],
): TimelineValidationResult<never> {
  return { ok: false, error: { code, message, segmentIds } };
}

/** Closed segments must end strictly after they start. Open segments must have endedAt=null. */
export function validateSegment(segment: TimeSegment): TimelineValidationResult {
  if (segment.endedAt !== null && segment.endedAt <= segment.startedAt) {
    return failure(
      'invalid_closed_duration',
      'Closed segment end must be after start.',
      [segment.id],
    );
  }

  return success(undefined);
}

function findOpenSegments(segments: readonly TimeSegment[]): TimeSegment[] {
  return segments.filter((segment) => segment.endedAt === null);
}

function findOverlaps(
  candidate: TimeSegment,
  others: readonly TimeSegment[],
): TimeSegment[] {
  return others.filter((other) => segmentsOverlap(candidate, other));
}

function validateCandidateAgainstTimeline(
  candidate: TimeSegment,
  segments: readonly TimeSegment[],
  excludeId?: string,
): TimelineValidationResult {
  const segmentResult = validateSegment(candidate);
  if (!segmentResult.ok) {
    return segmentResult;
  }

  const others = excludeId
    ? segments.filter((segment) => segment.id !== excludeId)
    : segments;

  if (candidate.endedAt === null) {
    const openOthers = findOpenSegments(others);
    if (openOthers.length > 0) {
      return failure(
        'multiple_open_segments',
        'Only one canonical timeline segment may be open.',
        [candidate.id, ...openOthers.map((segment) => segment.id)],
      );
    }
  }

  const overlapping = findOverlaps(candidate, others);
  if (overlapping.length > 0) {
    return failure(
      'overlap',
      'Canonical timeline segments may not overlap.',
      [candidate.id, ...overlapping.map((segment) => segment.id)],
    );
  }

  return success(undefined);
}

function validateUniqueIds(segments: readonly TimeSegment[]): TimelineValidationResult {
  const seen = new Set<string>();

  for (const segment of segments) {
    if (seen.has(segment.id)) {
      return failure('duplicate_id', 'Timeline segment IDs must be unique.', [segment.id]);
    }
    seen.add(segment.id);
  }

  return success(undefined);
}

/** Validate an entire timeline: segment shape, single open segment, and global non-overlap. */
export function validateTimeline(segments: readonly TimeSegment[]): TimelineValidationResult {
  const idResult = validateUniqueIds(segments);
  if (!idResult.ok) {
    return idResult;
  }

  for (const segment of segments) {
    const segmentResult = validateSegment(segment);
    if (!segmentResult.ok) {
      return segmentResult;
    }
  }

  const openSegments = findOpenSegments(segments);
  if (openSegments.length > 1) {
    return failure(
      'multiple_open_segments',
      'Only one canonical timeline segment may be open.',
      openSegments.map((segment) => segment.id),
    );
  }

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (segmentsOverlap(segments[i], segments[j])) {
        return failure(
          'overlap',
          'Canonical timeline segments may not overlap.',
          [segments[i].id, segments[j].id],
        );
      }
    }
  }

  return success(undefined);
}

/** Validate inserting a segment without mutating the timeline. */
export function validateSegmentInsert(
  segments: readonly TimeSegment[],
  segment: TimeSegment,
): TimelineValidationResult {
  if (segments.some((existing) => existing.id === segment.id)) {
    return failure('duplicate_id', 'Timeline segment IDs must be unique.', [segment.id]);
  }

  return validateCandidateAgainstTimeline(segment, segments);
}

/** Validate editing an existing segment without mutating the timeline. */
export function validateSegmentEdit(
  segments: readonly TimeSegment[],
  segmentId: string,
  patch: SegmentPatch,
): TimelineValidationResult {
  const existing = segments.find((segment) => segment.id === segmentId);
  if (!existing) {
    return failure('segment_not_found', 'Segment not found.', [segmentId]);
  }

  const candidate = { ...existing, ...patch } as TimeSegment;
  return validateCandidateAgainstTimeline(candidate, segments, segmentId);
}

/** Insert a segment when the resulting timeline would remain valid. */
export function insertSegment(
  segments: readonly TimeSegment[],
  segment: TimeSegment,
): TimelineValidationResult<TimeSegment[]> {
  const validation = validateSegmentInsert(segments, segment);
  if (!validation.ok) {
    return validation;
  }

  return success([...segments, segment]);
}

/** Apply an edit when the resulting timeline would remain valid. */
export function updateSegment(
  segments: readonly TimeSegment[],
  segmentId: string,
  patch: SegmentPatch,
): TimelineValidationResult<TimeSegment[]> {
  const validation = validateSegmentEdit(segments, segmentId, patch);
  if (!validation.ok) {
    return validation;
  }

  return success(
    segments.map((segment) =>
      segment.id === segmentId ? ({ ...segment, ...patch } as TimeSegment) : segment,
    ),
  );
}
