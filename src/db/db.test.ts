import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { TimeSegment } from '../domain/types';
import { META_KEYS, SETTING_KEYS } from './schema';
import { createDatabase, initializeDatabase, type WorkTrackDatabase } from './index';

const TEST_CONTEXT = {
  id: 'ctx-work',
  name: 'Work',
  targetMinutesPerDay: 480,
  plannedLunchMinutes: 30,
  expectedFinishEnabled: true,
  archived: false,
};

const TEST_TASK = {
  id: 'task-1',
  contextId: 'ctx-work',
  title: 'Ship persistence',
  status: 'open' as const,
  createdAt: 1_700_000_000_000,
};

const TEST_SEGMENT: TimeSegment = {
  id: 'seg-work',
  contextId: 'ctx-work',
  kind: 'work',
  taskId: 'task-1',
  startedAt: 1_700_000_000_000,
  endedAt: null,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

let testCounter = 0;
let activeDatabase: WorkTrackDatabase | undefined;

function createTestDatabase(): WorkTrackDatabase {
  testCounter += 1;
  return createDatabase(`worktrack-test-${testCounter}`);
}

afterEach(async () => {
  if (activeDatabase?.isOpen()) {
    activeDatabase.close();
  }
  activeDatabase = undefined;
});

describe('WorkTrackDatabase', () => {
  it('initializes cleanly with all canonical stores', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);

    expect(activeDatabase.isOpen()).toBe(true);
    expect(activeDatabase.tables.map((table) => table.name).sort()).toEqual(
      [
        'contexts',
        'focusSessions',
        'meta',
        'projects',
        'settings',
        'tags',
        'taskLinks',
        'tasks',
        'taskTags',
        'timeSegments',
      ].sort(),
    );
  });

  it('persists and reloads canonical records across close and reopen', async () => {
    const dbName = `worktrack-test-reload-${++testCounter}`;
    const writer = createDatabase(dbName);
    activeDatabase = writer;
    await initializeDatabase(writer);

    await writer.contexts.put(TEST_CONTEXT);
    await writer.projects.put({
      id: 'project-1',
      contextId: 'ctx-work',
      name: 'WorkTrack',
      archived: false,
    });
    await writer.tasks.put(TEST_TASK);
    await writer.tags.put({
      id: 'tag-1',
      contextId: 'ctx-work',
      name: 'Development',
      normalizedName: 'development',
      archived: false,
    });
    await writer.taskTags.put({ taskId: 'task-1', tagId: 'tag-1' });
    await writer.taskLinks.put({
      id: 'link-1',
      taskId: 'task-1',
      label: 'Issue',
      url: 'https://example.com/issues/1',
    });
    await writer.timeSegments.put(TEST_SEGMENT);
    await writer.focusSessions.put({
      id: 'focus-1',
      contextId: 'ctx-work',
      taskId: 'task-1',
      plannedMinutes: 25,
      startedAt: 1_700_000_100_000,
      endedAt: null,
      status: 'running',
    });
    await writer.settings.put({
      key: SETTING_KEYS.LAST_SEEN_AT,
      value: String(1_700_000_500_000),
    });
    await writer.meta.put({
      key: META_KEYS.INITIALIZED_AT,
      value: String(1_700_000_000_000),
    });

    writer.close();

    const reader = createDatabase(dbName);
    activeDatabase = reader;
    await initializeDatabase(reader);

    expect(await reader.contexts.get('ctx-work')).toEqual(TEST_CONTEXT);
    expect(await reader.tasks.get('task-1')).toEqual(TEST_TASK);
    expect(await reader.timeSegments.get('seg-work')).toEqual(TEST_SEGMENT);
    expect(await reader.taskTags.get(['task-1', 'tag-1'])).toEqual({
      taskId: 'task-1',
      tagId: 'tag-1',
    });
    expect(await reader.settings.get(SETTING_KEYS.LAST_SEEN_AT)).toEqual({
      key: SETTING_KEYS.LAST_SEEN_AT,
      value: String(1_700_000_500_000),
    });
  });

  it('supports indexed queries used by repositories', async () => {
    activeDatabase = createTestDatabase();
    await initializeDatabase(activeDatabase);

    await activeDatabase.timeSegments.bulkPut([
      TEST_SEGMENT,
      {
        id: 'seg-break',
        contextId: 'ctx-work',
        kind: 'break',
        startedAt: 1_700_001_000_000,
        endedAt: 1_700_001_500_000,
        createdAt: 1_700_001_000_000,
        updatedAt: 1_700_001_500_000,
      },
      {
        ...TEST_SEGMENT,
        id: 'seg-other-context',
        contextId: 'ctx-personal',
        startedAt: 1_700_002_000_000,
      },
    ]);

    await activeDatabase.tasks.bulkPut([
      TEST_TASK,
      {
        ...TEST_TASK,
        id: 'task-2',
        projectId: 'project-1',
        status: 'done',
      },
    ]);

    await activeDatabase.tags.bulkPut([
      {
        id: 'tag-1',
        contextId: 'ctx-work',
        name: 'Development',
        normalizedName: 'development',
        archived: false,
      },
    ]);

    const openSegments = await activeDatabase.timeSegments
      .filter((segment) => segment.endedAt === null)
      .toArray();
    const contextSegments = await activeDatabase.timeSegments
      .where('contextId')
      .equals('ctx-work')
      .toArray();
    const taskSegments = await activeDatabase.timeSegments.where('taskId').equals('task-1').toArray();
    const contextTasks = await activeDatabase.tasks.where('contextId').equals('ctx-work').toArray();
    const projectTasks = await activeDatabase.tasks.where('projectId').equals('project-1').toArray();
    const openTasks = await activeDatabase.tasks.where('status').equals('open').toArray();
    const tag = await activeDatabase.tags
      .where('[contextId+normalizedName]')
      .equals(['ctx-work', 'development'])
      .first();

    expect(openSegments.map((segment) => segment.id).sort()).toEqual(
      ['seg-other-context', 'seg-work'].sort(),
    );
    expect(contextSegments).toHaveLength(2);
    expect(taskSegments).toHaveLength(2);
    expect(contextTasks).toHaveLength(2);
    expect(projectTasks).toHaveLength(1);
    expect(openTasks).toHaveLength(1);
    expect(tag?.id).toBe('tag-1');
  });
});
