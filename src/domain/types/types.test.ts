import { describe, expect, it } from 'vitest';
import type {
  Context,
  FocusSession,
  Project,
  Tag,
  Task,
  TaskLink,
  TaskTag,
  TimeSegment,
  WorkSegment,
} from './index';

describe('domain types', () => {
  it('accepts work context with target and lunch configuration', () => {
    const context = {
      id: 'ctx-work',
      name: 'Work',
      targetMinutesPerDay: 480,
      plannedLunchMinutes: 30,
      expectedFinishEnabled: true,
      archived: false,
    } satisfies Context;

    expect(context.targetMinutesPerDay).toBe(480);
    expect(context.plannedLunchMinutes).toBe(30);
  });

  it('accepts personal context without target or lunch', () => {
    const context: Context = {
      id: 'ctx-personal',
      name: 'Personal',
      expectedFinishEnabled: false,
      archived: false,
    };

    expect(context.targetMinutesPerDay).toBeUndefined();
    expect(context.plannedLunchMinutes).toBeUndefined();
  });

  it('accepts tasks with initial and current estimates', () => {
    const task = {
      id: 'task-1',
      contextId: 'ctx-work',
      title: 'Define domain types',
      status: 'open',
      initialEstimateMinutes: 60,
      currentEstimateMinutes: 90,
      createdAt: 1_700_000_000_000,
    } satisfies Task;

    expect(task.initialEstimateMinutes).toBe(60);
    expect(task.currentEstimateMinutes).toBe(90);
  });

  it('accepts canonical timeline and focus overlay shapes', () => {
    const workSegment = {
      id: 'seg-work',
      contextId: 'ctx-work',
      kind: 'work',
      taskId: 'task-1',
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_360_000,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_360_000,
    } satisfies WorkSegment;

    const unassignedWork = {
      id: 'seg-unassigned',
      contextId: 'ctx-work',
      kind: 'work',
      startedAt: 1_700_001_000_000,
      endedAt: null,
      createdAt: 1_700_001_000_000,
      updatedAt: 1_700_001_000_000,
    } satisfies WorkSegment;

    const segments: TimeSegment[] = [
      workSegment,
      unassignedWork,
      {
        id: 'seg-break',
        contextId: 'ctx-work',
        kind: 'break',
        startedAt: 1_700_002_000_000,
        endedAt: null,
        createdAt: 1_700_002_000_000,
        updatedAt: 1_700_002_000_000,
      },
      {
        id: 'seg-lunch',
        contextId: 'ctx-work',
        kind: 'lunch',
        startedAt: 1_700_003_000_000,
        endedAt: null,
        createdAt: 1_700_003_000_000,
        updatedAt: 1_700_003_000_000,
      },
    ];

    const focusSession = {
      id: 'focus-1',
      contextId: 'ctx-work',
      taskId: 'task-1',
      plannedMinutes: 25,
      startedAt: 1_700_000_100_000,
      endedAt: null,
      status: 'running',
    } satisfies FocusSession;

    const project = {
      id: 'project-1',
      contextId: 'ctx-work',
      name: 'WorkTrack',
      archived: false,
    } satisfies Project;

    const tag = {
      id: 'tag-1',
      contextId: 'ctx-work',
      name: 'Development',
      normalizedName: 'development',
      archived: false,
    } satisfies Tag;

    const taskTag = {
      taskId: 'task-1',
      tagId: 'tag-1',
    } satisfies TaskTag;

    const taskLink = {
      id: 'link-1',
      taskId: 'task-1',
      label: 'Issue',
      url: 'https://example.com/issues/1',
    } satisfies TaskLink;

    expect(segments).toHaveLength(4);
    expect(focusSession.status).toBe('running');
    expect(project.name).toBe('WorkTrack');
    expect(tag.normalizedName).toBe('development');
    expect(taskTag.taskId).toBe('task-1');
    expect(taskLink.url).toContain('example.com');
  });
});
