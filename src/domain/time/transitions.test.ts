import { describe, expect, it } from 'vitest';
import type { TimeSegment } from '../types';
import { findOpenSegment, validateTimeline } from './index';
import {
  pauseWork,
  resumeWork,
  startLunch,
  startWork,
  stopWorkday,
} from './transitions';

const CONTEXT_ID = 'ctx-work';
const NOW = 1_700_010_000_000;
const EARLIER = NOW - 60 * 60 * 1_000;

const BASE = {
  contextId: CONTEXT_ID,
  createdAt: EARLIER,
  updatedAt: EARLIER,
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

function lunchSegment(id: string, startedAt: number, endedAt: number | null): TimeSegment {
  return {
    ...BASE,
    id,
    kind: 'lunch',
    startedAt,
    endedAt,
  };
}

function transitionInput(openSegmentId: string, nextSegmentId: string, taskId?: string) {
  return {
    now: NOW,
    openSegmentId,
    nextSegmentId,
    contextId: CONTEXT_ID,
    ...(taskId ? { taskId } : {}),
  };
}

function expectValidTimeline(segments: TimeSegment[]) {
  expect(validateTimeline(segments).ok).toBe(true);
  expect(findOpenSegment(segments)).toBeUndefined();
}

describe('startWork', () => {
  it('creates an open work segment at now', () => {
    const result = startWork([], {
      contextId: CONTEXT_ID,
      segmentId: 'work-1',
      startedAt: NOW,
      now: NOW,
      taskId: 'task-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const open = findOpenSegment(result.value);
      expect(open).toMatchObject({
        id: 'work-1',
        kind: 'work',
        startedAt: NOW,
        endedAt: null,
        taskId: 'task-1',
      });
      expect(validateTimeline(result.value).ok).toBe(true);
    }
  });

  it('supports a historical start time', () => {
    const result = startWork([], {
      contextId: CONTEXT_ID,
      segmentId: 'work-1',
      startedAt: EARLIER,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(findOpenSegment(result.value)?.startedAt).toBe(EARLIER);
    }
  });

  it('rejects starting while another segment is already open', () => {
    const segments = [workSegment('open', EARLIER, null)];
    const result = startWork(segments, {
      contextId: CONTEXT_ID,
      segmentId: 'work-2',
      startedAt: NOW,
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('already_tracking');
    }
  });

  it('rejects a historical start that overlaps existing segments', () => {
    const segments = [workSegment('closed', EARLIER, NOW - 30 * 60 * 1_000)];
    const result = startWork(segments, {
      contextId: CONTEXT_ID,
      segmentId: 'overlap',
      startedAt: NOW - 45 * 60 * 1_000,
      now: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('overlap');
    }
  });
});

describe('pauseWork', () => {
  it('closes work and opens break at the same timestamp', () => {
    const segments = [workSegment('work', EARLIER, null, 'task-1')];
    const result = pauseWork(segments, transitionInput('work', 'break-1'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const closedWork = result.value.find((segment) => segment.id === 'work');
      const openBreak = findOpenSegment(result.value);

      expect(closedWork?.endedAt).toBe(NOW);
      expect(openBreak).toMatchObject({
        id: 'break-1',
        kind: 'break',
        startedAt: NOW,
        endedAt: null,
      });
      expect(closedWork?.endedAt).toBe(openBreak?.startedAt);
      expect(validateTimeline(result.value).ok).toBe(true);
    }
  });

  it('rejects pausing when not on work', () => {
    const segments = [breakSegment('break', EARLIER, null)];
    const result = pauseWork(segments, transitionInput('break', 'break-2'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_transition');
    }
  });
});

describe('resumeWork', () => {
  it('closes break and opens work at the same timestamp', () => {
    const segments = [
      workSegment('work', EARLIER, NOW - 15 * 60 * 1_000, 'task-1'),
      breakSegment('break', NOW - 15 * 60 * 1_000, null),
    ];

    const result = resumeWork(segments, transitionInput('break', 'work-2'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const closedBreak = result.value.find((segment) => segment.id === 'break');
      const openWork = findOpenSegment(result.value);

      expect(closedBreak?.endedAt).toBe(NOW);
      expect(openWork).toMatchObject({
        id: 'work-2',
        kind: 'work',
        startedAt: NOW,
        taskId: 'task-1',
      });
      expect(closedBreak?.endedAt).toBe(openWork?.startedAt);
      expect(validateTimeline(result.value).ok).toBe(true);
    }
  });

  it('resumes from lunch and restores the previous task by default', () => {
    const segments = [
      workSegment('work', EARLIER, NOW - 30 * 60 * 1_000, 'task-1'),
      lunchSegment('lunch', NOW - 30 * 60 * 1_000, null),
    ];

    const result = resumeWork(segments, transitionInput('lunch', 'work-2'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(findOpenSegment(result.value)).toMatchObject({
        kind: 'work',
        taskId: 'task-1',
      });
    }
  });

  it('rejects resuming when not on break or lunch', () => {
    const segments = [workSegment('work', EARLIER, null)];
    const result = resumeWork(segments, transitionInput('work', 'work-2'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_transition');
    }
  });
});

describe('startLunch', () => {
  it('closes work and opens lunch at the same timestamp', () => {
    const segments = [workSegment('work', EARLIER, null)];
    const result = startLunch(segments, transitionInput('work', 'lunch-1'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      const closedWork = result.value.find((segment) => segment.id === 'work');
      const openLunch = findOpenSegment(result.value);

      expect(closedWork?.endedAt).toBe(NOW);
      expect(openLunch).toMatchObject({
        id: 'lunch-1',
        kind: 'lunch',
        startedAt: NOW,
      });
      expect(closedWork?.endedAt).toBe(openLunch?.startedAt);
      expect(validateTimeline(result.value).ok).toBe(true);
    }
  });

  it('rejects lunch when not on work', () => {
    const segments = [breakSegment('break', EARLIER, null)];
    const result = startLunch(segments, transitionInput('break', 'lunch-1'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_transition');
    }
  });
});

describe('stopWorkday', () => {
  it('closes the open work segment and leaves no open segment', () => {
    const segments = [workSegment('work', EARLIER, null)];
    const result = stopWorkday(segments, { now: NOW, openSegmentId: 'work' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(findOpenSegment(result.value)).toBeUndefined();
      expect(result.value.find((segment) => segment.id === 'work')?.endedAt).toBe(NOW);
      expectValidTimeline(result.value);
    }
  });

  it('can stop from break or lunch', () => {
    const breakTimeline = [breakSegment('break', EARLIER, null)];
    const lunchTimeline = [lunchSegment('lunch', EARLIER, null)];

    expect(stopWorkday(breakTimeline, { now: NOW, openSegmentId: 'break' }).ok).toBe(true);
    expect(stopWorkday(lunchTimeline, { now: NOW, openSegmentId: 'lunch' }).ok).toBe(true);
  });

  it('rejects stop when nothing is open', () => {
    const segments = [workSegment('closed', EARLIER, NOW - 15 * 60 * 1_000)];
    const result = stopWorkday(segments, { now: NOW, openSegmentId: 'closed' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('no_open_segment');
    }
  });
});

describe('workday transition flow', () => {
  it('preserves gapless boundaries across start, pause, resume, lunch, and stop', () => {
    let segments: TimeSegment[] = [];

    const started = startWork(segments, {
      contextId: CONTEXT_ID,
      segmentId: 'work-1',
      startedAt: EARLIER,
      now: EARLIER,
      taskId: 'task-1',
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    segments = started.value;

    const pausedAt = EARLIER + 2 * 60 * 60 * 1_000;
    const paused = pauseWork(segments, {
      ...transitionInput('work-1', 'break-1'),
      now: pausedAt,
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    segments = paused.value;

    const resumedAt = pausedAt + 10 * 60 * 1_000;
    const resumed = resumeWork(segments, {
      ...transitionInput('break-1', 'work-2'),
      now: resumedAt,
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    segments = resumed.value;

    const lunchAt = resumedAt + 2 * 60 * 60 * 1_000;
    const lunch = startLunch(segments, {
      ...transitionInput('work-2', 'lunch-1'),
      now: lunchAt,
    });
    expect(lunch.ok).toBe(true);
    if (!lunch.ok) return;
    segments = lunch.value;

    const stoppedAt = lunchAt + 30 * 60 * 1_000;
    const stopped = stopWorkday(segments, { now: stoppedAt, openSegmentId: 'lunch-1' });
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    segments = stopped.value;

    expect(findOpenSegment(segments)).toBeUndefined();
    expectValidTimeline(segments);

    const ordered = [...segments].sort((left, right) => left.startedAt - right.startedAt);
    expect(ordered).toHaveLength(4);
    expect(ordered[0].endedAt).toBe(ordered[1].startedAt);
    expect(ordered[1].endedAt).toBe(ordered[2].startedAt);
    expect(ordered[2].endedAt).toBe(ordered[3].startedAt);
  });
});
