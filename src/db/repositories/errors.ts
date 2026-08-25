import type {
  TimelineValidationError,
  TransitionError,
} from '../../domain/time';

export type PersistenceErrorDetails = TimelineValidationError | TransitionError;

export class TimelinePersistenceError extends Error {
  readonly details: PersistenceErrorDetails;

  constructor(details: PersistenceErrorDetails) {
    super(details.message);
    this.name = 'TimelinePersistenceError';
    this.details = details;
  }
}
