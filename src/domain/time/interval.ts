import type { TimeSegment } from '../types';

/** Upper bound of a segment interval. Open segments extend indefinitely. */
export function segmentEndAt(segment: TimeSegment): number {
  return segment.endedAt ?? Number.POSITIVE_INFINITY;
}

/** Half-open interval [startedAt, end). Adjacent segments that touch at one instant do not overlap. */
export function segmentsOverlap(a: TimeSegment, b: TimeSegment): boolean {
  return a.startedAt < segmentEndAt(b) && b.startedAt < segmentEndAt(a);
}
