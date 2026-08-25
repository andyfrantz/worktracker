import type { TimeSegment } from '../../domain/types';
import { segmentEndAt } from '../../domain/time';
import { validateTimeline } from '../../domain/time/invariants';
import type { WorkTrackDatabase } from '../index';
import { TimelinePersistenceError } from './errors';

export class TimeSegmentRepository {
  constructor(private readonly database: WorkTrackDatabase) {}

  async getAll(): Promise<TimeSegment[]> {
    return this.database.timeSegments.toArray();
  }

  async getOpenSegment(): Promise<TimeSegment | undefined> {
    return this.database.timeSegments.filter((segment) => segment.endedAt === null).first();
  }

  async getByContext(contextId: string): Promise<TimeSegment[]> {
    return this.database.timeSegments.where('contextId').equals(contextId).toArray();
  }

  async getByTask(taskId: string): Promise<TimeSegment[]> {
    return this.database.timeSegments.where('taskId').equals(taskId).toArray();
  }

  /** Return segments intersecting the half-open range [startAt, endAt). */
  async getIntersectingRange(startAt: number, endAt: number): Promise<TimeSegment[]> {
    return this.database.timeSegments
      .where('startedAt')
      .below(endAt)
      .filter((segment) => segmentEndAt(segment) > startAt)
      .toArray();
  }

  async syncValidated(nextSegments: readonly TimeSegment[]): Promise<void> {
    const validation = validateTimeline(nextSegments);
    if (!validation.ok) {
      throw new TimelinePersistenceError(validation.error);
    }

    await this.database.transaction('rw', this.database.timeSegments, async () => {
      const current = await this.database.timeSegments.toArray();
      const nextIds = new Set(nextSegments.map((segment) => segment.id));
      const deleteIds = current
        .filter((segment) => !nextIds.has(segment.id))
        .map((segment) => segment.id);

      if (deleteIds.length > 0) {
        await this.database.timeSegments.bulkDelete(deleteIds);
      }

      await this.database.timeSegments.bulkPut([...nextSegments]);
    });
  }
}
