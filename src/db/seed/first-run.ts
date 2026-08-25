import type { Context } from '../../domain/types';
import type { WorkTrackDatabase } from '../index';
import { META_KEYS } from '../schema';
import { DEFAULT_WORK_CONTEXT } from './default-contexts';

/** Seed the default Work context once on a fresh install. */
export async function seedFirstRunData(
  database: WorkTrackDatabase,
  now = Date.now(),
): Promise<Context | null> {
  const existingCount = await database.contexts.count();
  if (existingCount > 0) {
    return null;
  }

  return database.transaction('rw', [database.contexts, database.meta], async () => {
    const count = await database.contexts.count();
    if (count > 0) {
      return null;
    }

    await database.contexts.put(DEFAULT_WORK_CONTEXT);
    await database.meta.put({
      key: META_KEYS.INITIALIZED_AT,
      value: String(now),
    });
    await database.meta.put({
      key: META_KEYS.SCHEMA_VERSION,
      value: String(1),
    });

    return DEFAULT_WORK_CONTEXT;
  });
}

/** Return true when the database has no contexts yet. */
export async function isFreshInstall(database: WorkTrackDatabase): Promise<boolean> {
  return (await database.contexts.count()) === 0;
}
