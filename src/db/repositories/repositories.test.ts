import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { recoverWorkdayState } from '../../domain/workday';
import { createDatabase, initializeDatabase, type WorkTrackDatabase } from '../index';
import { createSegmentId, TimeSegmentRepository, WorkdayRepository } from './index';

const CONTEXT_ID = 'ctx-work';
const TASK_ID = 'task-1';
const STARTED_AT = 1_700_000_000_000;

let testCounter = 0;
let activeDatabase: WorkTrackDatabase | undefined;

function createTestDatabase(): WorkTrackDatabase {
  testCounter += 1;
  return createDatabase(`worktrack-repo-test-${testCounter}`);
}

afterEach(async () => {
  if (activeDatabase?.isOpen()) {
    activeDatabase.close();
  }
  activeDatabase = undefined;
});

describe('TimeSegmentRepository', () => {
  it('queries open, context, task, and range segments', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);
    const repository = new TimeSegmentRepository(activeDatabase);

    await repository.syncValidated([
      {
        id: 'work-open',
        contextId: CONTEXT_ID,
        kind: 'work',
        taskId: TASK_ID,
        startedAt: STARTED_AT,
        endedAt: null,
        createdAt: STARTED_AT,
        updatedAt: STARTED_AT,
      },
      {
        id: 'work-closed',
        contextId: CONTEXT_ID,
        kind: 'work',
        taskId: TASK_ID,
        startedAt: STARTED_AT - 4 * 60 * 60 * 1_000,
        endedAt: STARTED_AT - 2 * 60 * 60 * 1_000,
        createdAt: STARTED_AT - 4 * 60 * 60 * 1_000,
        updatedAt: STARTED_AT - 2 * 60 * 60 * 1_000,
      },
      {
        id: 'personal',
        contextId: 'ctx-personal',
        kind: 'work',
        startedAt: STARTED_AT - 6 * 60 * 60 * 1_000,
        endedAt: STARTED_AT - 5 * 60 * 60 * 1_000,
        createdAt: STARTED_AT - 6 * 60 * 60 * 1_000,
        updatedAt: STARTED_AT - 5 * 60 * 60 * 1_000,
      },
    ]);

    expect((await repository.getOpenSegment())?.id).toBe('work-open');
    expect((await repository.getByContext(CONTEXT_ID)).map((segment) => segment.id).sort()).toEqual(
      ['work-closed', 'work-open'].sort(),
    );
    expect((await repository.getByTask(TASK_ID)).map((segment) => segment.id).sort()).toEqual(
      ['work-closed', 'work-open'].sort(),
    );

    const range = await repository.getIntersectingRange(
      STARTED_AT - 3 * 60 * 60 * 1_000,
      STARTED_AT + 30 * 60 * 1_000,
    );
    expect(range.map((segment) => segment.id).sort()).toEqual(['work-closed', 'work-open'].sort());
  });
});

describe('WorkdayRepository', () => {
  it('persists start work and restores it after reload', async () => {
    const dbName = `worktrack-repo-reload-${++testCounter}`;
    const writer = createDatabase(dbName);
    activeDatabase = writer;
    await initializeDatabase(writer);

    const workday = new WorkdayRepository(writer);
    const segmentId = createSegmentId();
    const started = await workday.startWork({
      contextId: CONTEXT_ID,
      segmentId,
      startedAt: STARTED_AT,
      now: STARTED_AT,
      taskId: TASK_ID,
    });

    expect(started.ok).toBe(true);
    writer.close();

    const reader = createDatabase(dbName);
    activeDatabase = reader;
    await initializeDatabase(reader);

    const reloaded = new WorkdayRepository(reader);
    const openSegment = await reloaded.timeSegments.getOpenSegment();
    const recovery = recoverWorkdayState(await reloaded.timeSegments.getAll(), STARTED_AT + 1_000);

    expect(openSegment).toMatchObject({
      id: segmentId,
      kind: 'work',
      endedAt: null,
      taskId: TASK_ID,
    });
    expect(recovery.openSegment?.id).toBe(segmentId);
  });

  it('persists pause as an atomic close-and-open transition', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);
    const workday = new WorkdayRepository(activeDatabase);

    const workId = createSegmentId();
    const pauseAt = STARTED_AT + 2 * 60 * 60 * 1_000;
    await workday.startWork({
      contextId: CONTEXT_ID,
      segmentId: workId,
      startedAt: STARTED_AT,
      now: STARTED_AT,
    });

    const paused = await workday.pauseWork({
      now: pauseAt,
      openSegmentId: workId,
      nextSegmentId: createSegmentId(),
      contextId: CONTEXT_ID,
    });

    expect(paused.ok).toBe(true);
    const segments = await workday.timeSegments.getAll();
    const closedWork = segments.find((segment) => segment.id === workId);
    const openBreak = await workday.timeSegments.getOpenSegment();

    expect(closedWork?.endedAt).toBe(pauseAt);
    expect(openBreak).toMatchObject({
      kind: 'break',
      startedAt: pauseAt,
      endedAt: null,
    });
    expect(closedWork?.endedAt).toBe(openBreak?.startedAt);
  });

  it('does not persist invalid transitions', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);
    const workday = new WorkdayRepository(activeDatabase);

    const workId = createSegmentId();
    await workday.startWork({
      contextId: CONTEXT_ID,
      segmentId: workId,
      startedAt: STARTED_AT,
      now: STARTED_AT,
    });

    const before = await workday.timeSegments.getAll();
    const invalidPause = await workday.pauseWork({
      now: STARTED_AT + 1_000,
      openSegmentId: 'missing-segment',
      nextSegmentId: createSegmentId(),
      contextId: CONTEXT_ID,
    });

    expect(invalidPause.ok).toBe(false);
    expect(await workday.timeSegments.getAll()).toEqual(before);
  });

  it('rejects invalid timelines before persistence', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);
    const repository = new TimeSegmentRepository(activeDatabase);

    await expect(
      repository.syncValidated([
        {
          id: 'overlap-a',
          contextId: CONTEXT_ID,
          kind: 'work',
          startedAt: STARTED_AT,
          endedAt: STARTED_AT + 2_000,
          createdAt: STARTED_AT,
          updatedAt: STARTED_AT,
        },
        {
          id: 'overlap-b',
          contextId: CONTEXT_ID,
          kind: 'break',
          startedAt: STARTED_AT + 1_000,
          endedAt: STARTED_AT + 3_000,
          createdAt: STARTED_AT,
          updatedAt: STARTED_AT,
        },
      ]),
    ).rejects.toMatchObject({
      name: 'TimelinePersistenceError',
      details: { code: 'overlap' },
    });
  });
});
