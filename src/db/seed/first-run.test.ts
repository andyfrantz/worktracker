import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ContextRepository, WorkdayRepository, createDatabase, createSegmentId, initializeDatabase, seedFirstRunData, DEFAULT_WORK_CONTEXT, DEFAULT_WORK_CONTEXT_ID, type WorkTrackDatabase } from '../index';

let testCounter = 0;
let activeDatabase: WorkTrackDatabase | undefined;

function createTestDatabase(): WorkTrackDatabase {
  testCounter += 1;
  return createDatabase(`worktrack-seed-test-${testCounter}`);
}

afterEach(async () => {
  if (activeDatabase?.isOpen()) {
    activeDatabase.close();
  }
  activeDatabase = undefined;
});

describe('seedFirstRunData', () => {
  it('creates the default Work context on a fresh install', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);

    const seeded = await seedFirstRunData(activeDatabase, 1_700_000_000_000);

    expect(seeded).toEqual(DEFAULT_WORK_CONTEXT);
    expect(await activeDatabase.contexts.get(DEFAULT_WORK_CONTEXT_ID)).toEqual(DEFAULT_WORK_CONTEXT);
  });

  it('does not seed Personal and remains idempotent', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);

    await seedFirstRunData(activeDatabase, 1_700_000_000_000);
    const secondSeed = await seedFirstRunData(activeDatabase, 1_700_000_100_000);

    expect(secondSeed).toBeNull();
    expect(await activeDatabase.contexts.count()).toBe(1);
    expect(await activeDatabase.contexts.toArray()).toEqual([DEFAULT_WORK_CONTEXT]);
  });

  it('lets a fresh install start tracking immediately in the Work context', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);
    await seedFirstRunData(activeDatabase, 1_700_000_000_000);

    const contexts = new ContextRepository(activeDatabase);
    const workday = new WorkdayRepository(activeDatabase);
    const workContext = await contexts.getDefaultWorkContext();
    const startedAt = 1_700_010_000_000;

    expect(workContext).toEqual(DEFAULT_WORK_CONTEXT);

    const started = await workday.startWork({
      contextId: workContext!.id,
      segmentId: createSegmentId(),
      startedAt,
      now: startedAt,
    });

    expect(started.ok).toBe(true);
    expect((await workday.timeSegments.getOpenSegment())?.contextId).toBe(DEFAULT_WORK_CONTEXT_ID);
  });
});
