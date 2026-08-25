import {
  calculateWorkdaySummary,
  type WorkdaySummary,
} from '../domain/workday';
import {
  ContextRepository,
  WorkdayRepository,
  createSegmentId,
  db,
  type WorkTrackDatabase,
} from '../db';

export type WorkdayAction = 'lunch' | 'pause' | 'resume' | 'start' | 'stop';

let workdayRepository: WorkdayRepository | undefined;
let contextRepository: ContextRepository | undefined;
let boundDatabase: WorkTrackDatabase | undefined;

function getDatabase(): WorkTrackDatabase {
  return boundDatabase ?? db;
}

/** Bind a specific database instance, primarily for tests. Pass undefined to reset. */
export function bindWorkdayDatabase(database?: WorkTrackDatabase): void {
  boundDatabase = database;
  workdayRepository = undefined;
  contextRepository = undefined;
}

function repositories() {
  const database = getDatabase();
  workdayRepository ??= new WorkdayRepository(database);
  contextRepository ??= new ContextRepository(database);
  return { workday: workdayRepository, contexts: contextRepository };
}

export async function loadWorkdaySummary(now = Date.now()): Promise<WorkdaySummary | null> {
  const { contexts, workday } = repositories();
  const context = await contexts.getDefaultWorkContext();
  if (!context) {
    return null;
  }

  const segments = await workday.timeSegments.getAll();
  return calculateWorkdaySummary({
    now,
    context,
    segments,
  });
}

async function persistStart(startedAt: number, now: number): Promise<void> {
  const { contexts, workday } = repositories();
  const context = await contexts.getDefaultWorkContext();
  if (!context) {
    throw new Error('No Work context is available.');
  }

  const result = await workday.startWork({
    contextId: context.id,
    segmentId: createSegmentId(),
    startedAt,
    now,
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }
}

/** Start work at the current instant. */
export async function startWorkNow(now = Date.now()): Promise<void> {
  await persistStart(now, now);
}

/** Start work from a historical instant while keeping now as the current clock. */
export async function startWorkAt(startedAt: number, now = Date.now()): Promise<void> {
  await persistStart(startedAt, now);
}

export async function runWorkdayAction(action: WorkdayAction, now = Date.now()): Promise<void> {
  const { contexts, workday } = repositories();
  const context = await contexts.getDefaultWorkContext();
  if (!context) {
    throw new Error('No Work context is available.');
  }

  const openSegment = await workday.timeSegments.getOpenSegment();

  switch (action) {
    case 'start':
      await startWorkNow(now);
      return;
    case 'pause': {
      if (!openSegment) {
        throw new Error('Nothing is currently being tracked.');
      }
      const result = await workday.pauseWork({
        now,
        openSegmentId: openSegment.id,
        nextSegmentId: createSegmentId(),
        contextId: context.id,
      });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return;
    }
    case 'resume': {
      if (!openSegment) {
        throw new Error('Nothing is currently being tracked.');
      }
      const result = await workday.resumeWork({
        now,
        openSegmentId: openSegment.id,
        nextSegmentId: createSegmentId(),
        contextId: context.id,
      });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return;
    }
    case 'lunch': {
      if (!openSegment) {
        throw new Error('Nothing is currently being tracked.');
      }
      const result = await workday.startLunch({
        now,
        openSegmentId: openSegment.id,
        nextSegmentId: createSegmentId(),
        contextId: context.id,
      });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return;
    }
    case 'stop': {
      if (!openSegment) {
        throw new Error('Nothing is currently being tracked.');
      }
      const result = await workday.stopWorkday({
        now,
        openSegmentId: openSegment.id,
      });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    }
  }
}
