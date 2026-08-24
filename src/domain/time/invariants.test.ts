import { describe, expect, it } from 'vitest';
import type { TimeSegment } from '../types';
import {
  insertSegment,
  segmentEndAt,
  segmentsOverlap,
  updateSegment,
  validateSegment,
  validateSegmentEdit,
  validateSegmentInsert,
  validateTimeline,
} from './index';

const BASE = {
  contextId: 'ctx-work',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
} as const;

function workSegment(
  id: string,
  startedAt: number,
  endedAt: number | null,
  taskId?: string,
): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'work',
    startedAt,
    endedAt,
    ...(taskId ? { taskId } : {}),
  };
}

function breakSegment(id: string, startedAt: number, endedAt: number | null): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'break',
    startedAt,
    endedAt,
  };
}

describe('segmentEndAt', () => {
  it('uses endedAt for closed segments', () => {
    expect(segmentEndAt(workSegment('a', 100, 200))).toBe(200);
  });

  it('uses positive infinity for open segments', () => {
    expect(segmentEndAt(workSegment('a', 100, null))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('segmentsOverlap', () => {
  it('treats adjacent segments as non-overlapping', () => {
    const first = workSegment('a', 100, 200);
    const second = workSegment('b', 200, 300);

    expect(segmentsOverlap(first, second)).toBe(false);
    expect(segmentsOverlap(second, first)).toBe(false);
  });

  it('detects partial overlap', () => {
    const first = workSegment('a', 100, 250);
    const second = workSegment('b', 200, 300);

    expect(segmentsOverlap(first, second)).toBe(true);
  });

  it('detects nested overlap', () => {
    const outer = workSegment('outer', 100, 400);
    const inner = workSegment('inner', 150, 250);

    expect(segmentsOverlap(outer, inner)).toBe(true);
  });

  it('detects duplicate-start overlap', () => {
    const first = workSegment('a', 100, 200);
    const second = workSegment('b', 100, 300);

    expect(segmentsOverlap(first, second)).toBe(true);
  });

  it('detects overlap with an open segment', () => {
    const closed = workSegment('closed', 100, 200);
    const open = workSegment('open', 150, null);

    expect(segmentsOverlap(closed, open)).toBe(true);
  });

  it('allows a closed segment that ends when an open segment starts', () => {
    const closed = workSegment('closed', 100, 200);
    const open = workSegment('open', 200, null);

    expect(segmentsOverlap(closed, open)).toBe(false);
  });
});

describe('validateSegment', () => {
  it('accepts valid closed and open segments', () => {
    expect(validateSegment(workSegment('closed', 100, 200)).ok).toBe(true);
    expect(validateSegment(workSegment('open', 100, null)).ok).toBe(true);
  });

  it('rejects zero-duration closed segments', () => {
    const result = validateSegment(workSegment('zero', 100, 100));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_closed_duration');
    }
  });

  it('rejects negative-duration closed segments', () => {
    const result = validateSegment(workSegment('negative', 200, 100));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_closed_duration');
    }
  });
});

describe('validateTimeline', () => {
  it('accepts adjacent non-overlapping segments', () => {
    const segments = [
      workSegment('a', 100, 200),
      breakSegment('b', 200, 250),
      workSegment('c', 250, null),
    ];

    expect(validateTimeline(segments).ok).toBe(true);
  });

  it('rejects overlapping segments', () => {
    const segments = [workSegment('a', 100, 250), workSegment('b', 200, 300)];

    const result = validateTimeline(segments);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('overlap');
      expect(result.error.segmentIds).toEqual(['a', 'b']);
    }
  });

  it('rejects nested segments', () => {
    const segments = [workSegment('outer', 100, 400), workSegment('inner', 150, 250)];

    const result = validateTimeline(segments);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('overlap');
    }
  });

  it('rejects duplicate-start segments', () => {
    const segments = [workSegment('a', 100, 200), workSegment('b', 100, 300)];

    const result = validateTimeline(segments);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('overlap');
    }
  });

  it('rejects multiple open segments', () => {
    const segments = [workSegment('a', 100, null), breakSegment('b', 200, null)];

    const result = validateTimeline(segments);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('multiple_open_segments');
      expect(result.error.segmentIds).toEqual(['a', 'b']);
    }
  });

  it('rejects duplicate segment IDs', () => {
    const segments = [workSegment('dup', 100, 200), workSegment('dup', 200, 300)];

    const result = validateTimeline(segments);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('duplicate_id');
    }
  });

  it('rejects zero-duration segments in a timeline', () => {
    const segments = [workSegment('zero', 100, 100)];

    const result = validateTimeline(segments);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_closed_duration');
    }
  });
});

describe('validateSegmentInsert', () => {
  const existing = [workSegment('a', 100, 200)];

  it('accepts a non-overlapping insert', () => {
    const insert = breakSegment('b', 200, 250);

    expect(validateSegmentInsert(existing, insert).ok).toBe(true);
  });

  it('rejects an overlapping insert', () => {
    const insert = workSegment('b', 150, 250);

    const result = validateSegmentInsert(existing, insert);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('overlap');
    }
  });

  it('rejects inserting a second open segment', () => {
    const timeline = [workSegment('open', 100, null)];
    const insert = breakSegment('break', 200, null);

    const result = validateSegmentInsert(timeline, insert);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('multiple_open_segments');
    }
  });

  it('rejects duplicate IDs on insert', () => {
    const insert = workSegment('a', 300, 400);

    const result = validateSegmentInsert(existing, insert);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('duplicate_id');
    }
  });
});

describe('validateSegmentEdit', () => {
  const segments = [
    workSegment('a', 100, 200),
    breakSegment('b', 200, 250),
    workSegment('c', 250, 350),
  ];

  it('accepts a valid boundary edit', () => {
    const result = validateSegmentEdit(segments, 'b', { endedAt: 240 });

    expect(result.ok).toBe(true);
  });

  it('rejects an edit that creates overlap', () => {
    const result = validateSegmentEdit(segments, 'b', { endedAt: 300 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('overlap');
      expect(result.error.segmentIds).toContain('b');
      expect(result.error.segmentIds).toContain('c');
    }
  });

  it('rejects an edit that creates zero duration', () => {
    const result = validateSegmentEdit(segments, 'a', { endedAt: 100 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_closed_duration');
    }
  });

  it('rejects an edit that opens a second segment', () => {
    const timeline = [workSegment('open', 100, null), breakSegment('closed', 200, 250)];
    const result = validateSegmentEdit(timeline, 'closed', { endedAt: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('multiple_open_segments');
    }
  });

  it('rejects editing a missing segment', () => {
    const result = validateSegmentEdit(segments, 'missing', { endedAt: 300 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('segment_not_found');
    }
  });
});

describe('insertSegment', () => {
  it('returns an updated timeline on success', () => {
    const segments = [workSegment('a', 100, 200)];
    const insert = breakSegment('b', 200, 250);

    const result = insertSegment(segments, insert);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(validateTimeline(result.value).ok).toBe(true);
    }
  });

  it('does not mutate the original timeline on failure', () => {
    const segments = [workSegment('a', 100, 200)];
    const insert = workSegment('b', 150, 250);

    const result = insertSegment(segments, insert);
    expect(result.ok).toBe(false);
    expect(segments).toHaveLength(1);
  });
});

describe('updateSegment', () => {
  it('returns an updated timeline on success', () => {
    const segments = [workSegment('a', 100, 200), breakSegment('b', 200, 250)];

    const result = updateSegment(segments, 'b', { endedAt: 240 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.find((segment) => segment.id === 'b')?.endedAt).toBe(240);
      expect(validateTimeline(result.value).ok).toBe(true);
    }
  });

  it('does not mutate the original timeline on failure', () => {
    const segments = [
      workSegment('a', 100, 200),
      breakSegment('b', 200, 250),
      workSegment('c', 250, 350),
    ];

    const result = updateSegment(segments, 'b', { endedAt: 300 });
    expect(result.ok).toBe(false);
    expect(segments.find((segment) => segment.id === 'b')?.endedAt).toBe(250);
  });
});
