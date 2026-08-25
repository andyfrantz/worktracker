import {
  calculateWorkdaySummary,
  type WorkdaySummary,
} from '../domain/workday';
import {
  ContextRepository,
  WorkdayRepository,
  createSegmentId,
  db,
} from '../db';

export type WorkdayAction = 'lunch' | 'pause' | 'resume' | 'start' | 'stop';

let workdayRepository: WorkdayRepository | undefined;
let contextRepository: ContextRepository | undefined;

function repositories() {
  workdayRepository ??= new WorkdayRepository(db);
  contextRepository ??= new ContextRepository(db);
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

export async function runWorkdayAction(action: WorkdayAction, now = Date.now()): Promise<void> {
  const { contexts, workday } = repositories();
  const context = await contexts.getDefaultWorkContext();
  if (!context) {
    throw new Error('No Work context is available.');
  }

  const openSegment = await workday.timeSegments.getOpenSegment();

  switch (action) {
    case 'start': {
      const result = await workday.startWork({
        contextId: context.id,
        segmentId: createSegmentId(),
        startedAt: now,
        now,
      });
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return;
    }
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
