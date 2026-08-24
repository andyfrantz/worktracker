/** A work/personal mode grouping with optional daily targets and lunch assumptions. */
export interface Context {
  id: string;
  name: string;
  /** Daily work target in minutes. Omit when this context has no target. */
  targetMinutesPerDay?: number;
  /** Default lunch duration for finish prediction until actual lunch is recorded. */
  plannedLunchMinutes?: number;
  expectedFinishEnabled: boolean;
  archived: boolean;
}
