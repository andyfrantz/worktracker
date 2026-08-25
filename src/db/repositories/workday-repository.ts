import type { TimeSegment } from '../../domain/types';
import {
  pauseWork,
  resumeWork,
  startLunch,
  startWork,
  stopWorkday,
  type StartWorkInput,
  type TransitionInput,
  type TransitionResult,
} from '../../domain/time';
import type { WorkTrackDatabase } from '../index';
import { TimeSegmentRepository } from './time-segment-repository';

export function createSegmentId(): string {
  return crypto.randomUUID();
}

export class WorkdayRepository {
  readonly timeSegments: TimeSegmentRepository;

  constructor(private readonly database: WorkTrackDatabase) {
    this.timeSegments = new TimeSegmentRepository(database);
  }

  private async applyTransition(
    transform: (segments: readonly TimeSegment[]) => TransitionResult<TimeSegment[]>,
  ): Promise<TransitionResult<TimeSegment[]>> {
    const current = await this.timeSegments.getAll();
    const result = transform(current);
    if (!result.ok) {
      return result;
    }

    await this.timeSegments.syncValidated(result.value);
    return result;
  }

  startWork(input: StartWorkInput): Promise<TransitionResult<TimeSegment[]>> {
    return this.applyTransition((segments) => startWork(segments, input));
  }

  pauseWork(input: TransitionInput): Promise<TransitionResult<TimeSegment[]>> {
    return this.applyTransition((segments) => pauseWork(segments, input));
  }

  resumeWork(input: TransitionInput): Promise<TransitionResult<TimeSegment[]>> {
    return this.applyTransition((segments) => resumeWork(segments, input));
  }

  startLunch(input: TransitionInput): Promise<TransitionResult<TimeSegment[]>> {
    return this.applyTransition((segments) => startLunch(segments, input));
  }

  stopWorkday(
    input: Pick<TransitionInput, 'now' | 'openSegmentId'>,
  ): Promise<TransitionResult<TimeSegment[]>> {
    return this.applyTransition((segments) => stopWorkday(segments, input));
  }
}
