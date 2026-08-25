import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  Context,
  FocusSession,
  Project,
  Tag,
  Task,
  TaskLink,
  TaskTag,
  TimeSegment,
} from '../domain/types';
import { DB_NAME } from './schema';
import { registerMigrations } from './migrations';
import type { MetaRecord, SettingRecord } from './types';

export interface WorkTrackTables {
  contexts: EntityTable<Context, 'id'>;
  projects: EntityTable<Project, 'id'>;
  tasks: EntityTable<Task, 'id'>;
  tags: EntityTable<Tag, 'id'>;
  taskTags: Table<TaskTag, [string, string]>;
  taskLinks: EntityTable<TaskLink, 'id'>;
  timeSegments: EntityTable<TimeSegment, 'id'>;
  focusSessions: EntityTable<FocusSession, 'id'>;
  settings: EntityTable<SettingRecord, 'key'>;
  meta: EntityTable<MetaRecord, 'key'>;
}

export class WorkTrackDatabase extends Dexie {
  contexts!: WorkTrackTables['contexts'];
  projects!: WorkTrackTables['projects'];
  tasks!: WorkTrackTables['tasks'];
  tags!: WorkTrackTables['tags'];
  taskTags!: WorkTrackTables['taskTags'];
  taskLinks!: WorkTrackTables['taskLinks'];
  timeSegments!: WorkTrackTables['timeSegments'];
  focusSessions!: WorkTrackTables['focusSessions'];
  settings!: WorkTrackTables['settings'];
  meta!: WorkTrackTables['meta'];

  constructor(name = DB_NAME) {
    super(name);
    registerMigrations(this);
  }
}

export function createDatabase(name = DB_NAME): WorkTrackDatabase {
  return new WorkTrackDatabase(name);
}

/** Open the database and verify IndexedDB initialization succeeds. */
export async function initializeDatabase(database: WorkTrackDatabase): Promise<WorkTrackDatabase> {
  await database.open();
  return database;
}

export const db = createDatabase();

export type { MetaRecord, SettingRecord } from './types';
export {
  DB_NAME,
  DB_VERSION,
  META_KEYS,
  SCHEMA_V1_STORES,
  SETTING_KEYS,
  STORE_NAMES,
  type StoreName,
} from './schema';
export { registerMigrations } from './migrations';
export {
  createSegmentId,
  ContextRepository,
  TimeSegmentRepository,
  TimelinePersistenceError,
  WorkdayRepository,
  type PersistenceErrorDetails,
} from './repositories';
export {
  DEFAULT_WORK_CONTEXT,
  DEFAULT_WORK_CONTEXT_ID,
  DEFAULT_WORK_LUNCH_MINUTES,
  DEFAULT_WORK_TARGET_MINUTES,
  isFreshInstall,
  seedFirstRunData,
} from './seed';
