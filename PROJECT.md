# WorkTrack v2

## Product intent

WorkTrack is a small, local-first workday companion.

Its original purpose was simple: start the workday in the morning, see how much work time has elapsed, and know when the workday is expected to end. A default lunch break is included in that calculation. Everything else is secondary to that core job.

WorkTrack v2 should restore that simplicity while keeping the useful ideas that grew out of the original app: focus sessions, activity tracking, project/task context, estimates, and lightweight planning.

The product should remain useful even if the user never creates a task, project, tag, or todo.

## Core product hierarchy

WorkTrack v2 should be designed in this order:

1. **Workday** — accurate worked time and expected finish time.
2. **Focus** — optional Pomodoro/focus sessions that help the user stay on task.
3. **Activity** — optional tasks, projects, tags, and time segments that explain where the day went.
4. **Planning** — estimates, linked resources, queued tasks, and reusable metadata.
5. **Analytics** — insights derived from trustworthy historical data.

Features lower in this hierarchy must not make the higher levels slower or harder to use.

## Primary use case

At the beginning of a workday, the user starts WorkTrack.

The start time may be:

- now;
- a few minutes earlier; or
- manually entered.

This is important because work may already have started before the tracker is opened, for example while a development machine boots, updates, connects to VPN, or other startup work happens.

Once started, WorkTrack should prominently answer:

- Am I currently working?
- How much have I worked today?
- How much work time remains?
- When am I expected to be done today?

The expected finish time should account for the configured daily work target and lunch/break assumptions, and should update from actual recorded events as the day progresses.

Starting the workday must **not** require starting or naming a task.

## Workday model

The workday clock is independent of task tracking.

A user can have a fully valid WorkTrack day with no tasks at all.

The workday should support at least:

- start;
- pause;
- resume;
- lunch/break;
- stop;
- retroactive correction of start/end times;
- reliable recovery after refresh/restart;
- accurate finish-time prediction.

The default target may initially be an 8-hour workday with a 30-minute lunch, but these assumptions should ultimately be configurable rather than hard-coded.

## Focus / Pomodoro

Pomodoro exists only as a focus aid.

It is not a second work-time accounting system.

A focus session may run while the workday is active, optionally while a task is active. Starting, pausing, completing, or skipping a Pomodoro session must not silently alter recorded work time.

Pomodoro breaks and official work breaks are separate concepts unless the user explicitly chooses to connect them.

## Tasks and activities

Tasks are optional context for understanding how work time was spent.

A task may persist across multiple sessions and multiple days.

A single task can therefore have multiple time segments, for example:

- 09:00–10:15
- 11:00–11:48
- 14:20–15:02

The task's actual time is derived from its recorded segments.

Tasks should support:

- title;
- project;
- one or more tags;
- optional notes;
- optional estimate;
- actual tracked time;
- optional linked resources such as Jira issues, GitHub issues, documents, or other URLs;
- lifecycle/status such as open, active, done, or archived.

A user should be able to switch tasks quickly without manually ending and reconstructing timers.

Small spontaneous activities should remain low-friction. A quick activity can be started immediately and categorized later.

## Estimates and estimation feedback

Tasks may have an effort estimate.

WorkTrack should compare estimate vs actual time and retain that relationship after a task is completed.

Useful derived values include:

- absolute over/under time;
- percentage over/under estimate;
- historical estimation accuracy;
- estimation patterns by project, tag, or task type.

The purpose is personal feedback and improved estimation skill, not performance surveillance.

## Projects and contexts

WorkTrack should support multiple projects.

It should also support separating broad contexts such as:

- Work
- Personal

This makes it possible to use the same tracker during the workday and later for personal projects without mixing the two unintentionally.

Projects belong to a context/workspace-like grouping and may be archived when no longer active.

Switching context should be quick and visible.

## Tags

Tags should be managed centrally rather than relying only on unrestricted free text.

When assigning a tag, the user should be able to:

- select an existing tag;
- search/autocomplete existing tags;
- create a new tag when needed.

This should prevent accidental duplicates and spelling variants such as `meeting`, `Meeting`, `meetings`, and `mtg` unless they are intentionally separate.

Tags may optionally have subtle user-defined colors.

## Linked resources

Tasks may contain one or more linked resources.

The initial implementation should use a generic model such as:

- label;
- URL;
- optional detected resource type.

This allows Jira, GitHub, Linear, Figma, documents, Slack links, and other resources without requiring deep integrations.

Recognized URLs may be displayed more intelligently, for example showing a Jira issue key, while remaining simple links underneath.

Deep external integrations are not required for the initial v2.

## Timeline as source of truth

The original application accumulated several partially independent timers and inferred totals, which could lead to inconsistent work time, task time, pauses, quick tasks, and edited history.

WorkTrack v2 should avoid storing totals that can diverge from one another.

The canonical record should be a trustworthy timeline of events or time segments.

Examples include:

- work start;
- work pause;
- work resume;
- lunch/break start;
- break end;
- task segment start;
- task switch;
- task segment end;
- manual corrections.

Worked time, task duration, break time, overtime, daily totals, and analytics should be derived from that canonical data.

## Main interface

The main interface should represent **the day**, not expose the internal feature structure as many separate boxes and tabs.

The most important information should be immediately visible:

- current work status;
- worked time;
- remaining time;
- expected finish time;
- current activity/task, if any;
- today's timeline.

The timeline should eventually allow direct correction of recorded time, such as:

- editing a block;
- adjusting start/end boundaries;
- adding forgotten time;
- splitting or merging segments;
- assigning or changing a task/project/tag.

The UI should remain compact and utility-like rather than becoming a generic SaaS dashboard.

## Todos / planning

The standalone todo system from the original app should not be recreated as-is.

Where possible, planning items should be represented as tasks that may exist before any time has been tracked against them.

For example:

`Implement export · WorkTrack v2 · estimate 3h`

can later be started directly and accumulate actual time.

This avoids maintaining separate concepts for "todo" and "tracked task" when they refer to the same work.

WorkTrack should not attempt to become a full replacement for Jira, Linear, Notion, or other task-management systems.

## Analytics

Analytics are valuable only when based on reliable time data.

Potential future insights include:

- daily and weekly worked time;
- project allocation;
- tag/category allocation;
- estimate vs actual trends;
- average start and finish times;
- interruption/fragmentation patterns;
- overtime patterns;
- focus-session history.

Analytics should remain personal and explanatory rather than managerial or surveillance-oriented.

## Local-first principle

The original WorkTrack is intentionally local and dependency-light. That spirit should remain part of v2.

Basic use should require:

- no account;
- no login;
- no network connection;
- no external SaaS dependency.

Historical data belongs to the user.

A v2 should provide a clear backup/export/import path so long-term history is not trapped in one browser profile.

Future optional sync must not make basic local use dependent on a server.

## Product invariants

These are non-negotiable unless the product direction is explicitly changed:

1. The workday clock can run without an active task.
2. Task tracking must never be required to record valid work time.
3. Pomodoro/focus sessions do not independently modify work-time accounting.
4. A task can have multiple time segments across a day or across days.
5. Time totals are derived from a trustworthy canonical timeline/segment model.
6. Editing history must not silently lose or duplicate elapsed time.
7. Switching tasks should be fast and should close/open segments consistently.
8. Work and personal contexts can coexist without unintentionally mixing reporting.
9. Basic use requires no account or network connection.
10. WorkTrack should not evolve into a generic project-management suite.
11. Features must preserve the speed of the original "start work and see when I can stop" workflow.

## Current v1 lessons

The existing application contains several useful experiments, including:

- workday timer;
- pause/resume;
- lunch countdown;
- Pomodoro presets;
- task logging;
- quick tasks;
- editable entries;
- todos;
- day/week views;
- themes;
- desktop notifications;
- IndexedDB persistence.

The main lesson from v1 is not that these ideas are individually wrong. The problem is that they were added incrementally without a single underlying model, resulting in overlapping timers, inconsistent accounting, and UI organized around feature boxes rather than the user's day.

V2 should preserve the useful behaviors while rebuilding them on a coherent model.

## Explicitly out of scope for the initial rebuild

Unless reconsidered during architecture/product planning, the first version of the rebuild does not need:

- user accounts;
- team collaboration;
- employee monitoring;
- manager dashboards;
- deep Jira API integration;
- full project-management features;
- mandatory cloud synchronization;
- AI features merely for novelty.

AI may later be useful for optional tasks such as summarizing a day, suggesting categories, or recognizing repeated activities, but WorkTrack must remain fully useful without it.

## Success criteria

A successful WorkTrack v2 should make the following flow effortless:

1. Open the app in the morning.
2. Start the day, optionally correcting the actual start time.
3. Immediately see when the workday is expected to finish.
4. Optionally start a task or project activity.
5. Optionally use a focus timer while working.
6. Switch tasks or take breaks without corrupting time accounting.
7. Glance at the timeline and understand where the day went.
8. Correct mistakes quickly when necessary.
9. Stop the day with a trustworthy record of worked time.
10. Over time, learn how estimates compare with reality.

## Next design step

Technology choices are intentionally not specified in this document.

Before implementation, the project should define:

- application/platform approach;
- frontend framework or no-framework choice;
- language/tooling;
- persistence strategy;
- canonical event/segment data model;
- backup/export/import strategy;
- offline/PWA behavior;
- test strategy;
- future sync boundaries;
- repository structure and coding-agent guidance.

Those decisions should be documented separately in architecture/decision records and then reflected in `AGENTS.md`.
