import { describe, expect, it } from 'vitest';
import type { TimeSegment } from '../types';
import { calculateExpectedFinish } from '../workday';
import { calculateWorkedDuration } from './calculations';
import {
  changeSegmentKind,
  deleteSegment,
  editSegmentBoundaries,
  insertForgottenSegment,
  mergeAdjacentSegments,
  splitSegment,
} from './corrections';

const CONTEXT_ID = 'ctx-work';
const NOW = 1_700_100_000_000;
const DAY_START = 1_700_000_000_000;
const DAY_END = DAY_START + 24 * 60 * 60 * 1_000;

const BASE = {
  contextId: CONTEXT_ID,
  createdAt: DAY_START,
  updatedAt: DAY_START,
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

function breakSegment(id: string, startedAt: number, endedAt: number): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'break',
    startedAt,
    endedAt,
  };
}

function lunchSegment(id: string, startedAt: number, endedAt: number): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'lunch',
    startedAt,
    endedAt,
  };
}

describe('timeline corrections', () => {
  it('edits segment boundaries without creating overlap', () => {
    const segments = [
      workSegment('work', DAY_START + 1_000, DAY_START + 4_000),
      breakSegment('break', DAY_START + 4_000, DAY_START + 5_000),
    ];

    const result = editSegmentBoundaries(
      segments,
      'work',
      { endedAt: DAY_START + 3_500 },
      NOW,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.find((segment) => segment.id === 'work')?.endedAt).toBe(
        DAY_START + 3_500,
      );
    }
  });

  it('rejects boundary edits that would overlap another segment', () => {
    const segments = [
      workSegment('work', DAY_START + 1_000, DAY_START + 4_000),
      breakSegment('break', DAY_START + 4_000, DAY_START + 5_000),
    ];

    const result = editSegmentBoundaries(
      segments,
      'work',
      { endedAt: DAY_START + 4_500 },
      NOW,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('overlap');
    }
  });

  it('inserts a forgotten segment into a gap', () => {
    const segments = [
      workSegment('morning', DAY_START + 1_000, DAY_START + 4_000),
      workSegment('afternoon', DAY_START + 5_000, DAY_START + 8_000),
    ];
    const forgotten = breakSegment('forgotten-break', DAY_START + 4_000, DAY_START + 5_000);

    const result = insertForgottenSegment(segments, forgotten);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
    }
  });

  it('changes segment kind and updates derived worked time', () => {
    const segments = [breakSegment('break', DAY_START + 1_000, DAY_START + 3_000)];
    const before = calculateWorkedDuration(segments, { startAt: DAY_START, endAt: DAY_END }, NOW);

    const result = changeSegmentKind(segments, 'break', 'work', NOW, 'task-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = calculateWorkedDuration(result.value, { startAt: DAY_START, endAt: DAY_END }, NOW);
    expect(before).toBe(0);
    expect(after).toBe(2_000);
  });

  it('changes break to lunch without changing duration facts', () => {
    const segments = [breakSegment('pause', DAY_START + 1_000, DAY_START + 2_000)];
    const result = changeSegmentKind(segments, 'pause', 'lunch', NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        kind: 'lunch',
        startedAt: DAY_START + 1_000,
        endedAt: DAY_START + 2_000,
      });
    }
  });

  it('deletes an erroneous segment', () => {
    const segments = [
      workSegment('keep', DAY_START + 1_000, DAY_START + 2_000),
      breakSegment('remove', DAY_START + 2_000, DAY_START + 3_000),
    ];

    const result = deleteSegment(segments, 'remove');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.id).toBe('keep');
    }
  });

  it('splits a closed segment at an interior point', () => {
    const segments = [workSegment('work', DAY_START + 1_000, DAY_START + 4_000, 'task-1')];
    const result = splitSegment(segments, {
      segmentId: 'work',
      at: DAY_START + 2_500,
      secondSegmentId: 'work-2',
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const ordered = [...result.value].sort((left, right) => left.startedAt - right.startedAt);
      expect(ordered).toHaveLength(2);
      expect(ordered[0]?.endedAt).toBe(DAY_START + 2_500);
      expect(ordered[1]?.startedAt).toBe(DAY_START + 2_500);
      expect(ordered[1]?.endedAt).toBe(DAY_START + 4_000);
    }
  });

  it('splits an open segment into closed and open parts', () => {
    const segments = [workSegment('work', DAY_START + 1_000, null)];
    const result = splitSegment(segments, {
      segmentId: 'work',
      at: DAY_START + 2_000,
      secondSegmentId: 'work-open',
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const closed = result.value.find((segment) => segment.id === 'work');
      const open = result.value.find((segment) => segment.id === 'work-open');

      expect(closed?.endedAt).toBe(DAY_START + 2_000);
      expect(open).toMatchObject({
        startedAt: DAY_START + 2_000,
        endedAt: null,
      });
    }
  });

  it('merges compatible adjacent segments', () => {
    const segments = [
      workSegment('work-a', DAY_START + 1_000, DAY_START + 2_000, 'task-1'),
      workSegment('work-b', DAY_START + 2_000, DAY_START + 4_000, 'task-1'),
    ];

    const result = mergeAdjacentSegments(segments, 'work-a', 'work-b', NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        kind: 'work',
        startedAt: DAY_START + 1_000,
        endedAt: DAY_START + 4_000,
        taskId: 'task-1',
      });
    }
  });

  it('rejects merging non-adjacent or incompatible segments', () => {
    const adjacentDifferentTask = [
      workSegment('a', DAY_START + 1_000, DAY_START + 2_000, 'task-1'),
      workSegment('b', DAY_START + 2_000, DAY_START + 3_000, 'task-2'),
    ];
    const nonAdjacent = [
      workSegment('a', DAY_START + 1_000, DAY_START + 2_000, 'task-1'),
      workSegment('b', DAY_START + 2_500, DAY_START + 3_000, 'task-1'),
    ];

    const incompatible = mergeAdjacentSegments(adjacentDifferentTask, 'a', 'b', NOW);
    const gap = mergeAdjacentSegments(nonAdjacent, 'a', 'b', NOW);

    expect(incompatible.ok).toBe(false);
    expect(gap.ok).toBe(false);
    if (!incompatible.ok) {
      expect(incompatible.error.code).toBe('segments_not_mergeable');
    }
    if (!gap.ok) {
      expect(gap.error.code).toBe('segments_not_adjacent');
    }
  });

  it('updates expected finish when corrections change worked time', () => {
    const segments = [
      workSegment('work', DAY_START + 1_000, DAY_START + 3_000),
      breakSegment('break', DAY_START + 3_000, DAY_START + 3_500),
    ];
    const before = calculateExpectedFinish({
      now: DAY_START + 4_000,
      workedMs: calculateWorkedDuration(
        segments,
        { startAt: DAY_START, endAt: DAY_END },
        DAY_START + 4_000,
      ),
      targetMinutesPerDay: 8 * 60,
      plannedLunchMinutes: 30,
      lunchOccurred: false,
      skipPlannedLunch: false,
    });

    const corrected = changeSegmentKind(segments, 'break', 'work', NOW);
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;

    const after = calculateExpectedFinish({
      now: DAY_START + 4_000,
      workedMs: calculateWorkedDuration(
        corrected.value,
        { startAt: DAY_START, endAt: DAY_END },
        DAY_START + 4_000,
      ),
      targetMinutesPerDay: 8 * 60,
      plannedLunchMinutes: 30,
      lunchOccurred: false,
      skipPlannedLunch: false,
    });

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after!).toBeLessThan(before!);
  });
});
