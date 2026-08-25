export const DB_NAME = 'worktrack';
export const DB_VERSION = 1;

export const STORE_NAMES = {
  contexts: 'contexts',
  projects: 'projects',
  tasks: 'tasks',
  tags: 'tags',
  taskTags: 'taskTags',
  taskLinks: 'taskLinks',
  timeSegments: 'timeSegments',
  focusSessions: 'focusSessions',
  settings: 'settings',
  meta: 'meta',
} as const;

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

/** Dexie store definitions for schema version 1. */
export const SCHEMA_V1_STORES: Record<StoreName, string> = {
  contexts: 'id, name, archived',
  projects: 'id, contextId, archived, name',
  tasks: 'id, contextId, projectId, status, createdAt',
  tags: 'id, contextId, normalizedName, [contextId+normalizedName], archived',
  taskTags: '[taskId+tagId], taskId, tagId',
  taskLinks: 'id, taskId',
  timeSegments: 'id, contextId, kind, taskId, startedAt, endedAt',
  focusSessions: 'id, contextId, taskId, startedAt, endedAt, status',
  settings: 'key',
  meta: 'key',
};

export const SETTING_KEYS = {
  LAST_SEEN_AT: 'lastSeenAt',
  TIMEZONE: 'timezone',
} as const;

export const META_KEYS = {
  INITIALIZED_AT: 'initializedAt',
  SCHEMA_VERSION: 'schemaVersion',
} as const;
