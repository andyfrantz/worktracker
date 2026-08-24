# WorkTrack v2 — Architecture & Time Semantics

## Status

Initial architecture decision record for WorkTrack v2.

This document translates the product intent in `PROJECT.md` into implementation rules. It is intentionally opinionated about time accounting because trustworthy time data is the foundation of the product.

---

## 1. Chosen stack

WorkTrack v2 is a local-first static web application.

- **UI:** Svelte
- **Language:** TypeScript
- **Build/dev server:** Vite
- **Persistence:** IndexedDB via Dexie
- **Unit/domain tests:** Vitest
- **Browser/E2E tests:** Playwright
- **Deployment:** static files
- **Backend:** none
- **Authentication:** none
- **Cloud dependency:** none
- **PWA:** planned after the core browser app is correct

The application must remain useful without a network connection after its static assets have been loaded.

### Why this stack

The app is stateful enough that plain DOM manipulation would recreate much of the complexity of v1, but it does not need a server framework or a large client architecture. Svelte provides components and reactive UI with little ceremony. Dexie keeps IndexedDB manageable and versioned without introducing a backend.

---

## 2. Architectural principle

> **The database records facts. The domain layer derives time. The UI only displays and edits those facts.**

No UI component may maintain an independent authoritative counter for worked time, task time, remaining time, overtime, estimate variance, or expected finish.

Every displayed duration must be derived from persisted segments plus the current clock (`now`).

This is the primary safeguard against the inconsistencies that developed in v1.

---

## 3. Product hierarchy

The architecture follows the product hierarchy:

1. **Workday** — start, pause, lunch, stop, worked time, remaining time, expected finish.
2. **Focus** — optional Pomodoro/focus sessions layered on top of work.
3. **Activity** — optional tasks/projects explaining where work time went.
4. **Planning** — estimates, links, managed tags, queued tasks.
5. **Analytics** — entirely derived from trustworthy historical facts.

A user must be able to use WorkTrack successfully without ever creating a task.

---

## 4. Core time invariant

> **Worked time comes exclusively from work segments.**

Tasks, Pomodoro sessions, estimates, UI state, and configured schedules never add to or subtract from worked time directly.

For a closed work segment:

```text
worked duration = endedAt - startedAt
```

For the currently open work segment:

```text
worked duration = now - startedAt
```

Total worked time for a period is the sum of the intersections of work segments with that period.

There are no accumulated stopwatch counters such as `totalWorked += ...` stored as authoritative state.

---

## 5. Canonical timeline model

WorkTrack uses one canonical table for mutually exclusive tracked time:

```ts
interface TimeSegment {
  id: string;
  contextId: string;
  kind: 'work' | 'break' | 'lunch';
  taskId?: string;       // allowed only for kind='work'
  startedAt: number;     // epoch milliseconds
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
```

### Why a unified segment table

The first design considered separate Work and Break tables. A unified timeline is preferable because:

- work, break, and lunch are mutually exclusive states;
- switching state can be transactional;
- overlap validation lives in one place;
- timeline rendering becomes straightforward;
- lunch remains semantically explicit;
- worked time is still trivial to query: sum only `kind='work'`.

Gaps between segments are allowed. A gap means **WorkTrack was not tracking a state**; it is not automatically considered a break.

Focus sessions are deliberately **not** part of this table because they may overlap work time and do not affect work accounting.

---

## 6. Global overlap rule

> **Canonical timeline segments may never overlap.**

Because WorkTrack v2 allows only one actively tracked context at a time, this rule is global rather than merely per context.

Invalid:

```text
09:00–10:00  Work / Task A
09:45–10:30  Work / Task B
```

Valid task switch:

```text
09:00–09:45  Work / Task A
09:45–10:30  Work / Task B
```

Focus sessions are exempt from this rule and may overlap work segments.

All segment creation/editing operations must validate this invariant in the domain layer before persistence.

---

## 7. Starting work

Starting work creates a real historical segment.

If the current time is 08:24 and the user chooses **Start now**:

```text
08:24 → running   work
```

If the user says they started at 08:15:

```text
08:15 → running   work
```

There is no special "offset", "already worked" counter, or adjustment field.

If the user later corrects 08:15 to 08:09, WorkTrack edits the segment's `startedAt`. All derived values recalculate automatically.

### Start UX

The primary action remains one click:

```text
Start now
```

A secondary "started earlier" affordance allows direct time entry and may later offer convenience presets such as `-5m`, `-10m`, `-15m`.

---

## 8. Pausing, resuming, and stopping

### Pause

Pausing work:

1. closes the open work segment at `now`;
2. opens a `break` segment at the same timestamp.

Example:

```text
08:15–10:22  work
10:22→       break
```

### Resume

Resuming:

1. closes the open break segment;
2. opens a new work segment at the same timestamp;
3. by default restores the task from the most recent work segment in that context, if one existed.

```text
10:22–10:37  break
10:37→       work / previous task
```

The UI may allow resuming as unassigned work instead.

### Stop

Stopping the workday:

1. closes the currently open timeline segment;
2. does **not** create another break segment;
3. leaves no active segment.

A later Start creates a new work segment. The gap between Stop and Start is simply untracked/off-duty time.

---

## 9. Lunch

Lunch is an explicit segment kind because it has special meaning for finish-time prediction.

Starting lunch while working performs an atomic state transition:

```text
work → lunch
```

Ending lunch performs:

```text
lunch → work
```

The previous task should be resumed by default, but task assignment is still optional.

An ordinary break may later be relabeled as lunch through timeline editing if the user forgot to press the lunch action.

---

## 10. Expected finish calculation

Expected finish is **derived and never persisted as truth**.

For a context with a daily work target:

```text
remainingWork = max(0, targetWork - workedSoFar)

expectedFinish = now
               + remainingWork
               + expectedFutureLunch
```

Past breaks are not added separately. They have already moved `now` forward while `workedSoFar` remained unchanged.

### Example A — before lunch

```text
start:          08:00
target:         8h
planned lunch:  30m
now:            10:00
worked:         2h
```

```text
remaining work = 6h
future lunch   = 30m
finish         = 16:30
```

### Example B — a 10 minute coffee break happened

At 10:10, only 2h has been worked:

```text
remaining work = 6h
future lunch   = 30m
finish         = 16:40
```

No special "break penalty" is required. Wall-clock time already accounts for it.

### Example C — lunch actually lasts 42 minutes

Once lunch ends, there is no future planned lunch remaining:

```text
expectedFutureLunch = 0
```

The 42 elapsed minutes already moved `now`, so the expected finish naturally becomes 12 minutes later than the original 30-minute assumption.

### Example D — lunch lasts only 20 minutes

Once lunch ends, WorkTrack does not force another 10 minutes merely because the configured plan was 30 minutes. The actual lunch replaces the assumption.

The expected finish therefore becomes 10 minutes earlier than the original prediction.

---

## 11. Future lunch semantics

Each context may define an optional planned lunch duration.

Before lunch occurs:

```text
expectedFutureLunch = configuredPlannedLunch
```

While lunch is active:

```text
expectedFutureLunch = max(0, configuredPlannedLunch - currentLunchElapsed)
```

After any lunch segment has occurred for the relevant workday:

```text
expectedFutureLunch = 0
```

If lunch runs longer than planned, no negative duration is introduced. The excess time has already affected the wall clock.

### Skip planned lunch

The user may explicitly choose **Skip planned lunch today**.

This is a day-specific planning override, not a historical time segment.

It sets:

```text
expectedFutureLunch = 0
```

without changing recorded work or break facts.

Ordinary breaks do not automatically satisfy the lunch assumption. If a normal break was actually lunch, the user may relabel it.

---

## 12. Daily planning overrides

Context settings provide defaults, but predictions sometimes need a day-specific choice such as skipping lunch or changing today's target.

Use a small per-day planning record:

```ts
interface DayPlan {
  id: string;
  contextId: string;
  localDate: string;             // YYYY-MM-DD in the context/user timezone
  targetMinutesOverride?: number;
  plannedLunchMinutesOverride?: number;
  skipPlannedLunch?: boolean;
}
```

This record is not the source of worked-time history. It only affects planning/prediction semantics.

Historical actual work remains segment-based.

---

## 13. Tasks

Tasks persist independently of time segments.

```ts
interface Task {
  id: string;
  contextId: string;
  projectId?: string;
  title: string;
  notes?: string;
  status: 'open' | 'done' | 'archived';
  initialEstimateMinutes?: number;
  currentEstimateMinutes?: number;
  createdAt: number;
  completedAt?: number;
}
```

A task may have:

- zero work segments;
- one work segment;
- many work segments;
- segments across multiple days.

Actual task time is always derived:

```text
actual(task) = sum(work segments where taskId = task.id)
```

A completed task may be reopened and receive new work segments without losing history.

---

## 14. Estimates

Estimate quality is a product feature, so the original estimate must not be silently overwritten.

At minimum store:

```text
initialEstimateMinutes
currentEstimateMinutes
```

If an estimate changes from 2h to 5h, both facts remain available.

Derived values include:

```text
actual = sum(task work segments)
absolute variance = actual - initial estimate
percentage variance = (actual - initial) / initial * 100
```

Later versions may introduce explicit estimate revisions, but the initial estimate must remain recoverable from day one.

---

## 15. Task switching

Switching tasks does **not** pause the workday.

If Task A is active and the user starts Task B at 10:07:

```text
Task A: 09:14–10:07  work
Task B: 10:07→       work
```

The transition is atomic and gapless.

This replaces the special "quick task" model from v1.

A spontaneous interruption is simply another task switch. The UI may offer **Resume previous task** for convenience, but there is no special quick-task timing system underneath.

---

## 16. Unassigned work

A work segment may have no task.

```text
08:11–08:29  work / taskId=null
```

This is valid, first-class work time.

Typical examples:

- laptop startup;
- email triage;
- deciding what to do;
- tiny miscellaneous work;
- work the user does not care to categorize.

The product must never require a task before starting or continuing the workday clock.

The user may optionally assign an unassigned segment to a task later.

---

## 17. Focus / Pomodoro semantics

Pomodoro is a focus aid, not a work-accounting system.

```ts
interface FocusSession {
  id: string;
  contextId: string;
  taskId?: string;
  plannedMinutes: number;
  startedAt: number;
  endedAt: number | null;
  status: 'running' | 'completed' | 'cancelled';
}
```

Starting, pausing, completing, or cancelling a focus session:

- does not start work;
- does not stop work;
- does not create work time;
- does not remove work time;
- does not directly affect expected finish.

If a task is active when focus begins, WorkTrack may attach that task ID for analytics.

Focus sessions may overlap canonical work segments.

---

## 18. Contexts

Contexts separate different modes of life, initially:

```text
Work
Personal
```

```ts
interface Context {
  id: string;
  name: string;
  targetMinutesPerDay?: number;
  plannedLunchMinutes?: number;
  expectedFinishEnabled: boolean;
  archived: boolean;
}
```

Example:

```text
Work
  target: 8h
  planned lunch: 30m
  expected finish: enabled

Personal
  target: none
  planned lunch: none
  expected finish: disabled
```

Only one canonical timeline segment may be active globally, so Work and Personal cannot accidentally run simultaneously.

Switching context while tracking requires closing/switching the current canonical segment.

---

## 19. Projects

Projects belong to a context.

```ts
interface Project {
  id: string;
  contextId: string;
  name: string;
  description?: string;
  archived: boolean;
}
```

Examples:

```text
Work
├── Client ABC
├── Internal Platform
└── Admin

Personal
├── WorkTrack
├── Homelab
└── Photography
```

A task may exist without a project.

---

## 20. Managed tags

Tags are predefined, selectable metadata rather than unconstrained repeated free text.

```ts
interface Tag {
  id: string;
  contextId: string;
  name: string;
  normalizedName: string;
  archived: boolean;
}
```

`normalizedName` is used to prevent accidental duplicates such as:

```text
meeting
Meeting
MEETING
```

The UI should support autocomplete and allow creating a new tag inline when needed.

Tasks may have multiple tags through a join table:

```ts
interface TaskTag {
  taskId: string;
  tagId: string;
}
```

Tags answer "what kind of activity is this?" while projects answer "what larger thing is this for?"

---

## 21. Task links

External links use a generic model rather than a Jira-specific API integration.

```ts
interface TaskLink {
  id: string;
  taskId: string;
  label?: string;
  url: string;
}
```

The UI may recognize known URL shapes and present them intelligently, for example showing a Jira issue key, but the persisted model remains generic.

This supports Jira, GitHub, Linear, Figma, documentation, Slack links, and future systems without migrations for each provider.

---

## 22. Time zones, midnight, and DST

Persist timestamps as epoch milliseconds representing absolute instants.

Display and calendar grouping use the user's configured/local timezone.

Segments may cross midnight.

Example:

```text
23:30 → 00:45
```

The segment remains one stored fact, but day reports intersect it with local calendar boundaries:

```text
Monday:  30m
Tuesday: 45m
```

Do not split or mutate the persisted segment solely for reporting.

DST transitions must be tested explicitly. Duration is based on elapsed instants, not naive local clock subtraction.

---

## 23. Timeline editing

Editing the timeline edits facts rather than totals.

Supported domain operations should eventually include:

- move segment start;
- move segment end;
- change segment kind;
- assign/unassign/change task;
- split a segment;
- merge compatible adjacent segments;
- insert forgotten historical work/break/lunch;
- delete an erroneous segment.

Every edit must preserve overlap invariants.

Derived work totals, task actuals, estimates, expected finish, and analytics update automatically.

---

## 24. Edge-case semantics

### 24.1 "I worked 20 minutes before opening WorkTrack"

If it is 08:20 and the user says they began at 08:00, create:

```text
08:00→ work
```

No correction counter is used.

### 24.2 "Laptop booting counts as work"

Same behavior. The user enters the actual start time. WorkTrack does not care whether the browser was running during that interval.

### 24.3 "I took lunch but forgot to press Lunch"

If the user paused 12:15–12:47, edit that segment from `break` to `lunch`.

If no pause was recorded at all, split/edit the work segment to insert the historical lunch interval.

### 24.4 "I paused for 45 minutes, but that was actually a meeting"

A meeting counts as work.

The user converts the break interval into a work segment and may assign it to a meeting task/tag.

Worked time increases automatically.

### 24.5 "I forgot to stop the timer last night"

On return, WorkTrack shows the still-open segment and makes correction prominent.

The user edits its end to the actual stop time.

WorkTrack must never silently guess the missing end time.

A later enhancement may detect suspiciously long open segments and offer a repair prompt, but it must not rewrite history automatically.

### 24.6 "The laptop slept for 47 minutes"

By default, time remains work if the work segment stayed open.

Computer inactivity is not proof that work stopped.

A later wake-detection feature may ask whether the interval should remain work or become a break. It must never silently remove time.

### 24.7 "I stop Work at 17:00 and start Personal at 19:00"

```text
Work:     ... → 17:00
19:00 → Personal
```

The two contexts report separately.

### 24.8 "I switch directly from Work to Personal"

At the transition timestamp, close the Work segment and open the Personal work segment atomically.

No overlap and no forced gap.

### 24.9 "I finish my target while a lunch assumption is still pending"

Once `workedSoFar >= targetWork`, remaining work is zero.

The day is considered complete. A still-unconsumed planned lunch does not push the finish into the future after the target has already been achieved.

The UI should show completion/overtime rather than "you still owe a lunch".

### 24.10 "I work overtime"

```text
overtime = max(0, workedSoFar - targetWork)
```

Expected finish is no longer relevant once the target is reached. The primary display becomes the overtime amount.

### 24.11 "Personal has no target"

No expected finish or remaining-work value is calculated.

WorkTrack shows actual tracked time only.

---

## 25. Expected-finish reference algorithm

Conceptual TypeScript:

```ts
function expectedFinish(input: {
  now: number;
  workedMs: number;
  targetMs?: number;
  plannedLunchMs?: number;
  lunchOccurred: boolean;
  lunchActiveElapsedMs?: number;
  skipPlannedLunch: boolean;
}): number | null {
  if (input.targetMs == null) return null;

  const remainingWork = Math.max(0, input.targetMs - input.workedMs);
  if (remainingWork === 0) return input.now;

  let futureLunch = 0;

  if (!input.skipPlannedLunch && !input.lunchOccurred) {
    const planned = input.plannedLunchMs ?? 0;
    const elapsed = input.lunchActiveElapsedMs ?? 0;
    futureLunch = Math.max(0, planned - elapsed);
  }

  return input.now + remainingWork + futureLunch;
}
```

The production implementation should derive `workedMs`, lunch state, and day plan from repositories/domain queries rather than trusting arbitrary UI-provided totals.

---

## 26. Persistence tables

Initial Dexie schema, conceptually:

```text
contexts
projects
tasks
tags
taskTags
taskLinks
timeSegments
focusSessions
dayPlans
settings
```

Indexes should support at least:

- time segments by `startedAt`;
- time segments by context;
- time segments by task;
- tasks by context/project/status;
- tags by context/normalizedName;
- day plans by context + local date.

Exact Dexie index syntax belongs in implementation, not this architecture document.

---

## 27. Domain services

Recommended modules:

```text
src/
  domain/
    time/
      calculations.ts
      overlap.ts
      transitions.ts
      day-boundaries.ts
    workday/
      summary.ts
      expected-finish.ts
      commands.ts
    tasks/
      actuals.ts
      estimates.ts
    focus/
      sessions.ts

  db/
    schema.ts
    migrations.ts
    repositories/

  components/
  views/
  app/
```

The exact folder structure may evolve, but dependencies should flow roughly:

```text
UI → domain services → repositories → Dexie
```

Time calculations should remain usable in pure unit tests without Svelte, IndexedDB, or browser DOM dependencies.

---

## 28. Required domain tests

Time arithmetic is core product behavior and receives disproportionate test coverage.

Minimum categories:

### Workday

- start now;
- historical start;
- pause/resume;
- multiple pauses;
- stop and restart same day;
- unassigned work;
- task switches without gaps;
- overtime.

### Finish prediction

- target with planned lunch;
- ordinary break before lunch;
- lunch shorter than planned;
- lunch longer than planned;
- active lunch with remaining planned duration;
- skipped planned lunch;
- no lunch configured;
- target already reached;
- context without target.

### Editing

- adjust historical start;
- insert forgotten lunch;
- convert break to work;
- split and merge;
- reject overlaps;
- repair forgotten stop.

### Dates

- segment crossing midnight;
- DST spring-forward;
- DST fall-back;
- local-day intersection calculations.

### Tasks / estimates

- task across multiple segments;
- task across multiple days;
- initial estimate preserved after revision;
- actual vs initial estimate variance;
- reopen completed task.

---

## 29. Browser/E2E tests

Keep E2E coverage small and high-value. Initial Playwright flows should cover approximately:

1. start earlier → expected finish is correct;
2. pause/resume → worked time remains correct;
3. lunch → finish prediction updates correctly;
4. start/switch/finish task → actual time aggregates correctly;
5. reload with active work segment → state recovers from persisted facts;
6. edit timeline → all derived totals update;
7. switch Work → Personal → histories remain separate;
8. estimate vs actual survives reload.

Do not duplicate every arithmetic unit test at the browser level.

---

## 30. Crash/reload behavior

The app must not rely on a one-second timer loop for persistence correctness.

If the browser closes while this exists:

```text
08:15 → null   work
```

then reopening later still represents an active work segment from 08:15.

The UI's one-second tick is presentation only. It causes recalculation of displays from `now`; it is not responsible for accumulating truth.

This makes browser reloads and temporary suspension inherently recoverable.

---

## 31. Transactions

State transitions that replace one segment with another must be atomic at the persistence layer when possible.

Examples:

- work → break;
- break → work;
- work → lunch;
- lunch → work;
- Task A → Task B;
- Work context → Personal context.

A failed transition must not leave two open segments or overlapping segments.

---

## 32. PWA boundary

PWA functionality is not part of the first implementation milestone.

Core first:

```text
static browser app
correct persisted timeline
correct finish calculation
correct task aggregation
correct editing
```

Then add:

```text
manifest
installability
offline asset cache
update handling
icons
```

Local data is already offline-capable because it lives in IndexedDB.

---

## 33. Explicitly out of scope for initial v2

Do not add these during the initial rebuild unless the architecture is deliberately revised:

- backend server;
- accounts/authentication;
- cloud sync;
- team/company tracking;
- employee surveillance features;
- Jira API integration;
- calendar integration;
- automatic idle-time deletion;
- AI-generated features;
- complex task-management workflows;
- dependencies solely to avoid writing small domain functions;
- parallel active contexts;
- automatic rewriting of suspicious time history.

---

## 34. Non-negotiable invariants

These should later be copied into `AGENTS.md`:

1. The workday clock may run without an active task.
2. Work time comes only from canonical `work` segments.
3. Pomodoro/focus never changes recorded work time.
4. A task may own many work segments across many days.
5. Task switching does not pause work.
6. There is no special quick-task timing model.
7. Canonical timeline segments may not overlap.
8. Expected finish is derived, never persisted as authoritative state.
9. Historical corrections edit facts/segments, not accumulated counters.
10. The app must not silently infer that computer inactivity means non-work.
11. Basic use requires no account, backend, or network connection.
12. UI components do not implement independent time arithmetic.
13. The initial estimate of a task is preserved for later estimation analysis.
14. Contexts may have different or no daily targets.
15. One canonical tracked state may be active globally at a time.

---

## 35. Implementation order

Recommended milestone order:

### M1 — Time engine

- Dexie schema and migrations;
- canonical timeline segment model;
- start/pause/resume/lunch/stop transitions;
- overlap validation;
- workday summary;
- expected-finish calculation;
- domain tests.

No task UI required yet.

### M2 — Minimal WorkTrack UI

Recreate the original core promise beautifully:

```text
Started 08:12
Worked 03:41
Remaining 04:19
Done ~16:42
```

with Start/Pause/Lunch/Stop and historical-start correction.

At this point the app is already useful.

### M3 — Timeline editing

- today's timeline;
- edit boundaries;
- insert/split/relabel segments;
- fix forgotten start/stop/lunch;
- overlap-safe editing.

### M4 — Tasks and projects

- contexts;
- projects;
- persistent tasks;
- task switching;
- resume previous task;
- generic links;
- managed tags.

### M5 — Estimates

- initial/current estimate;
- actual aggregation;
- variance display;
- lightweight estimation history.

### M6 — Focus

- Pomodoro/focus session layer;
- presets/settings;
- notifications;
- optional task association.

### M7 — Review and resilience

- day/week review;
- project/tag breakdown;
- import/export/backup;
- PWA/installability;
- targeted analytics.

This sequencing deliberately ensures WorkTrack returns to its original useful core before rebuilding the features that accumulated later.

---

## 36. Decision summary

WorkTrack v2 is not primarily a task manager with a timer attached.

It is a local-first workday clock with a trustworthy editable timeline. Tasks, projects, estimates, tags, and focus sessions explain or enhance the timeline but never redefine its accounting.

The most important implementation decision is therefore not Svelte or Dexie. It is this:

> **Persist real intervals. Derive everything else.**
