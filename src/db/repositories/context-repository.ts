import type { Context } from '../../domain/types';
import type { WorkTrackDatabase } from '../index';
import { DEFAULT_WORK_CONTEXT_ID } from '../seed/default-contexts';

export class ContextRepository {
  constructor(private readonly database: WorkTrackDatabase) {}

  async getAll(): Promise<Context[]> {
    return this.database.contexts.toArray();
  }

  async getById(contextId: string): Promise<Context | undefined> {
    return this.database.contexts.get(contextId);
  }

  async getDefaultWorkContext(): Promise<Context | undefined> {
    return this.getById(DEFAULT_WORK_CONTEXT_ID);
  }

  async count(): Promise<number> {
    return this.database.contexts.count();
  }
}
