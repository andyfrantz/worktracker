import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { calculateWorkdaySummary } from '../domain/workday';
import {
  ContextRepository,
  WorkdayRepository,
  createDatabase,
  initializeDatabase,
  seedFirstRunData,
  type WorkTrackDatabase,
} from '../db';
import { startWorkAt, startWorkNow, bindWorkdayDatabase } from './workday';

const NOW = new Date(2026, 7, 24, 10, 0, 0, 0).getTime();
const EARLIER = NOW - 2 * 60 * 60 * 1_000;
const EXPECTED_FINISH = new Date(2026, 7, 24, 16, 30, 0, 0).getTime();

let testCounter = 0;
let activeDatabase: WorkTrackDatabase | undefined;

function createTestDatabase(): WorkTrackDatabase {
  testCounter += 1;
  return createDatabase(`worktrack-start-test-${testCounter}`);
}

async function setupWorkday(database: WorkTrackDatabase) {
  await initializeDatabase(database);
  await seedFirstRunData(database, NOW);
}

describe('startWorkAt', () => {
  afterEach(async () => {
    bindWorkdayDatabase(undefined);
    if (activeDatabase?.isOpen()) {
      activeDatabase.close();
    }
    activeDatabase = undefined;
  });

  it('creates a historical segment and updates finish prediction immediately', async () => {
    activeDatabase = createTestDatabase();
    await setupWorkday(activeDatabase);
    bindWorkdayDatabase(activeDatabase);

    await startWorkAt(EARLIER, NOW);

    const workday = new WorkdayRepository(activeDatabase);
    const contexts = new ContextRepository(activeDatabase);
    const context = await contexts.getDefaultWorkContext();
    const openSegment = await workday.timeSegments.getOpenSegment();
    const summary = calculateWorkdaySummary({
      now: NOW,
      context: context!,
      segments: await workday.timeSegments.getAll(),
    });

    expect(openSegment?.startedAt).toBe(EARLIER);
    expect(summary.workedMs).toBe(2 * 60 * 60 * 1_000);
    expect(summary.expectedFinish).toBe(EXPECTED_FINISH);
  });

  it('rejects overlapping historical starts without persisting them', async () => {
    activeDatabase = createTestDatabase();
    await setupWorkday(activeDatabase);
    bindWorkdayDatabase(activeDatabase);

    const workday = new WorkdayRepository(activeDatabase);
    await workday.timeSegments.syncValidated([
      {
        id: 'existing-work',
        contextId: 'ctx-work',
        kind: 'work',
        startedAt: NOW - 2 * 60 * 60 * 1_000,
        endedAt: NOW - 60 * 60 * 1_000,
        createdAt: NOW - 2 * 60 * 60 * 1_000,
        updatedAt: NOW - 60 * 60 * 1_000,
      },
    ]);

    await expect(startWorkAt(NOW - 90 * 60 * 1_000, NOW)).rejects.toThrow(/overlap/i);

    expect((await workday.timeSegments.getAll())).toHaveLength(1);
  });
});
