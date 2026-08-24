# WorkTrack v2 — Agent Instructions

## Purpose

This repository contains WorkTrack v2, a small local-first workday companion.

Before making implementation changes, read:

1. `PROJECT.md` — product intent and scope.
2. `ARCHITECTURE.md` — technical architecture, data model, and time semantics.
3. This file — implementation rules for coding agents.

If these documents appear to conflict, preserve the product intent in `PROJECT.md` and the time-accounting invariants in `ARCHITECTURE.md`. Do not silently reinterpret either document. Record any necessary architecture change explicitly before implementing it.

---

## Product priority

WorkTrack is not a generic productivity suite.

The product hierarchy is:

1. **Workday** — accurate worked time and expected finish.
2. **Focus** — optional Pomodoro/focus aid.
3. **Activity** — optional tasks, projects, tags, and time attribution.
4. **Planning** — estimates, links, and queued tasks.
5. **Analytics** — derived insights only.

A lower-priority feature must never make a higher-priority workflow slower, harder, or less reliable.

The application must remain useful when the user creates no task, project, tag, estimate, or link.

---

## Non-negotiable product rules

Do not violate these rules without an explicit architecture decision:

- Starting the workday never requires an active task.
- Work time comes exclusively from canonical timeline segments with `kind='work'`.
- There is no authoritative accumulated stopwatch counter.
- Expected finish is derived, never persisted as historical truth.
- Tasks may span multiple segments and multiple days.
- Switching tasks does not pause the workday.
- Unassigned work is valid first-class work.
- Pomodoro/focus sessions never create, remove, pause, or redefine worked time.
- Planned lunch affects prediction only until actual lunch history replaces that assumption.
- Computer inactivity or sleep must never silently remove work time.
- Missing/forgotten stop times must never be guessed and rewritten automatically.
- Canonical timeline segments may never overlap globally.
- Only one canonical timeline segment may be active globally.
- Basic use requires no account, backend, or network dependency.
- User history must remain exportable and recoverable.

---

## Chosen stack

Use the agreed stack unless an explicit architecture decision changes it:

- Svelte
- TypeScript
- Vite
- IndexedDB via Dexie
- Vitest for unit/domain tests
- Playwright for critical browser flows
- Static deployment
- No backend
- No authentication

Do not introduce SvelteKit, React, Next.js, Electron, Tauri, a server database, a state-management framework, GraphQL, REST APIs, Docker, or cloud services merely because they are familiar.

New dependencies require a clear reason. Prefer platform features, existing stack capabilities, and small focused libraries over broad frameworks.

---

## Architecture boundary

The core rule is:

> **The database records facts. The domain layer derives time. The UI only displays and edits those facts.**

### UI responsibilities

Svelte components may:

- render domain results;
- collect user intent;
- call application/domain operations;
- maintain transient presentation state such as open dialogs, selection, hover, or draft form values.

Svelte components must not independently calculate or persist authoritative:

- worked time;
- task actual time;
- remaining work;
- expected finish;
- overtime;
- break totals;
- estimate variance;
- timeline overlap logic.

If time arithmetic appears inside a component beyond simple formatting, move it into the domain layer.

### Persistence responsibilities

Dexie repositories/tables store facts and perform persistence concerns.

Persistence code must not become the primary home for business semantics. Validation and calculations belong in domain/application functions that can be tested without a browser database when practical.

### Domain responsibilities

Domain code owns:

- segment invariants;
- start/pause/resume/stop transitions;
- task switching;
- timeline edits;
- worked-time calculation;
- daily boundary intersections;
- expected-finish calculation;
- overtime calculation;
- task actuals;
- estimate variance;
- lunch prediction semantics;
- context transition rules.

Prefer pure functions for calculations.

---

## Canonical time model

The canonical tracked timeline uses `TimeSegment` facts with kinds:

- `work`
- `break`
- `lunch`

A work segment may optionally reference a task.

Focus/Pomodoro sessions are separate overlapping records and are not canonical work-accounting segments.

Never reintroduce v1-style parallel authoritative timers such as:

- day stopwatch total;
- task stopwatch total;
- quick-task stopwatch total;
- Pomodoro-derived work total.

Displayed clocks should be recomputed from persisted facts plus the current `now` value.

---

## Time handling rules

Use epoch milliseconds for persisted instants.

Do not persist naive local date/time values as the authoritative timestamp for timeline history.

Calendar reporting may use local date boundaries, but persisted segments must remain real instants and may cross midnight.

DST-sensitive arithmetic must use elapsed instants, not naive local clock subtraction.

All functions involving the current time should accept or otherwise isolate `now` so they are deterministic under test. Avoid scattering direct `Date.now()` calls through domain logic.

---

## Atomic transitions

State transitions that touch adjacent segments must behave atomically.

Examples:

- work → break
- break → work
- work → lunch
- lunch → work
- Task A → Task B
- Work context → Personal context

At a transition timestamp, close the existing segment and open the next at exactly the same instant unless the user's edit intentionally creates a gap.

Never create transient overlaps as persisted history.

Use Dexie transactions for multi-record persistence operations where partial writes could corrupt the canonical timeline.

---

## Timeline editing

Timeline editing changes recorded facts, never compensation counters.

When implementing edits such as move, resize, split, merge, relabel, delete, or insert:

1. validate the resulting interval(s);
2. validate global non-overlap;
3. preserve context/task references where semantically appropriate;
4. persist atomically;
5. derive all totals again from the resulting facts.

Do not patch totals after edits.

If an edit is ambiguous or destructive, prefer an explicit user choice rather than silent repair.

---

## Expected-finish semantics

Expected finish must follow `ARCHITECTURE.md`.

At a high level:

```text
remainingWork = max(0, targetWork - workedSoFar)
expectedFinish = now + remainingWork + expectedFutureLunch
```

Past breaks are not added again because they have already advanced wall-clock time.

Once the work target has been reached, expected finish is no longer the primary state. Show completion/overtime instead.

Contexts without a target do not have expected-finish semantics.

Do not add hidden heuristics to this calculation.

---

## Tasks, projects, tags, links

Tasks are optional planning/activity records and must not become prerequisites for work tracking.

A task's actual duration is always derived from its work segments.

Projects answer "what larger thing is this for?"

Tags answer "what kind of activity is this?"

Tags are managed entities with normalized names. Prevent accidental case-only duplicates unless a future product decision explicitly changes normalization rules.

External resources remain generic task links (`label` + `url`). Recognizing Jira/GitHub/etc. is presentation enhancement, not a reason to introduce provider-specific storage in the core model.

Do not add deep Jira, GitHub, Linear, Figma, or Slack API integrations unless explicitly requested.

---

## Estimates

Never silently overwrite the original task estimate.

At minimum preserve:

- initial estimate;
- current estimate;
- actual derived time.

Estimation analytics exist to help the user learn estimation patterns, not to create employee-performance metrics.

Do not introduce scoring, ranking, productivity grades, or surveillance-oriented features without an explicit product decision.

---

## Focus / Pomodoro

Treat focus sessions as an optional overlay.

Focus code must remain decoupled from canonical work accounting.

A focus session may reference the active task for later analytics, but that reference must not alter task/work duration.

Do not make starting a focus session mandatory when starting a task or workday.

---

## UX principles

The main interface represents **the day**, not the internal feature architecture.

Avoid recreating the v1 pattern of one card/tab per subsystem.

The primary screen should optimize for quick answers to:

- Am I working?
- How much have I worked?
- How much remains?
- When am I done?
- What am I working on?
- What happened today?

Primary workday actions must stay low-friction.

Prefer direct manipulation of the timeline over modal-heavy administration where practical.

Do not add onboarding, dashboards, gamification, notification clutter, account UI, collaboration UI, or generic SaaS patterns without a clear requirement.

Accessibility is part of correctness:

- use semantic controls;
- preserve keyboard operation;
- provide visible focus states;
- label icon-only actions;
- do not rely on color alone to communicate state.

---

## Suggested project structure

Use a structure close to this unless implementation evidence strongly favors a small variation:

```text
src/
  app/
  components/
  views/
  domain/
    workday/
    timeline/
    tasks/
    focus/
    estimates/
  db/
    schema.ts
    migrations.ts
    repositories/
  services/
  lib/
  types/

tests/
  e2e/
```

Do not over-fragment the repository into dozens of tiny abstraction layers. A module should exist because it owns a coherent responsibility, not to satisfy a pattern.

---

## Testing requirements

Time arithmetic is core product logic and requires strong automated coverage.

### Domain/unit tests

Use Vitest for deterministic tests of at least:

- start now;
- retroactive start;
- pause/resume;
- lunch start/end;
- planned lunch before lunch;
- actual lunch shorter than plan;
- actual lunch longer than plan;
- skip planned lunch for the day;
- ordinary breaks affecting finish naturally;
- target reached before planned lunch;
- overtime;
- task switches without work gaps;
- unassigned work;
- task actuals across multiple segments;
- task actuals across multiple days;
- estimate over/under calculations;
- global overlap rejection;
- historical segment insertion;
- split/merge behavior;
- midnight-crossing segments;
- DST transitions;
- context switching;
- context with no target;
- recovery of an open segment;
- suspiciously long open segment remaining unchanged until user correction.

When a bug involving time semantics is fixed, add a regression test before or with the fix.

### E2E tests

Keep Playwright coverage focused on critical user journeys rather than duplicating unit coverage.

Initial critical flows should include:

1. start work retroactively and see correct expected finish;
2. pause/resume and see finish move correctly;
3. take lunch and see the planned assumption replaced by actual lunch;
4. start/switch/complete tasks while the workday continues correctly;
5. reload/reopen with an active segment and recover the correct state;
6. correct historical time from the timeline and see all derived values update.

---

## Quality gate

Once the project is bootstrapped, changes should normally leave these commands passing:

```bash
npm run check
npm run test
npm run build
```

For changes affecting user flows or persistence:

```bash
npm run test:e2e
```

If the actual package scripts differ after bootstrap, update this section so agents have one canonical command set.

Do not claim a change is complete when relevant tests are failing.

---

## Persistence and migrations

Treat IndexedDB schema changes as durable migrations, even during early development once real usage data exists.

- Increment Dexie schema versions intentionally.
- Do not casually delete or rename persisted fields without migration logic.
- Prefer additive migrations when feasible.
- Test migrations that transform timeline history.
- Never wipe the user's database as an automatic fix for a migration issue.

The eventual export format should be documented and versioned. Import must validate data before merging/replacing local history.

---

## Error handling and recovery

Data integrity beats convenience.

When an operation would create impossible history, reject it with a useful explanation rather than silently normalizing it.

When the app detects suspicious history, such as an open segment extending overnight, surface a correction path but preserve the recorded fact until the user changes it.

Avoid destructive auto-repair.

---

## Dependency discipline

Before adding a dependency, ask:

1. Is this solving a WorkTrack problem or a framework-preference problem?
2. Can Svelte, TypeScript, Dexie, or the browser already do it clearly?
3. Does the dependency materially reduce complexity over its lifetime?
4. Does it introduce network/backend/account assumptions?

Do not add a global state library by default. Prefer domain services/stores only where reactive shared state is genuinely needed.

Do not add a date/time library merely for formatting. A library may be justified later if timezone/calendar semantics become clearer and safer with it, but elapsed time must remain based on real instants.

---

## Scope discipline

When implementing a requested feature, make the smallest coherent change that preserves the architecture.

Do not opportunistically build adjacent roadmap ideas.

In particular, do not turn WorkTrack into:

- a Jira replacement;
- a Notion replacement;
- a team time-tracking product;
- an employee monitoring tool;
- a collaboration platform;
- a cloud-first service;
- a generic habit tracker;
- a gamified productivity app.

If a feature starts pushing in one of these directions, stop and check product intent before proceeding.

---

## Coding style

Prefer readable TypeScript over clever abstractions.

- Use explicit domain names such as `TimeSegment`, `DayPlan`, `expectedFinish`, and `workedDuration`.
- Prefer pure calculation functions.
- Keep side effects at application/persistence boundaries.
- Avoid hidden mutable singleton state for canonical history.
- Avoid magic numbers for target/lunch/focus durations.
- Model optional values explicitly.
- Use discriminated unions where they make illegal states harder to represent.
- Keep UI state separate from persisted domain state.
- Comment decisions and non-obvious semantics, not obvious syntax.

When implementing a domain operation, prefer APIs that express intent, for example:

```ts
startWork(...)
pauseWork(...)
resumeWork(...)
startLunch(...)
switchTask(...)
editSegment(...)
calculateWorkdaySummary(...)
```

rather than exposing raw database mutation throughout the application.

---

## What to do before coding a feature

For non-trivial changes:

1. Read the relevant section of `PROJECT.md`.
2. Read the relevant semantics in `ARCHITECTURE.md`.
3. Identify the canonical facts being created or edited.
4. Identify the derived values affected.
5. Add/update domain tests for the behavior.
6. Implement domain behavior before UI plumbing when practical.
7. Add persistence changes/migrations if required.
8. Build the simplest UI that exposes the behavior.
9. Run relevant checks/tests.

If the requested behavior cannot be implemented without violating a documented invariant, do not work around the invariant silently. Explain the conflict and propose an explicit architecture/product decision.

---

## Documentation discipline

Keep documentation aligned with the code.

Update `ARCHITECTURE.md` when changing:

- canonical data model;
- time semantics;
- overlap rules;
- persistence strategy;
- context semantics;
- expected-finish calculation;
- technology stack.

Update `PROJECT.md` only when product intent or scope changes.

Update this `AGENTS.md` when coding workflow, quality gates, or agent-specific guardrails change.

Do not duplicate large sections across documents unnecessarily. Link/reference the authoritative document instead.

---

## Current implementation priority

Unless the project roadmap explicitly changes, implementation should proceed roughly in this order:

1. project bootstrap and quality tooling;
2. Dexie schema and repositories;
3. canonical timeline domain model;
4. worked-time and expected-finish calculations;
5. start/pause/resume/lunch/stop flows;
6. main day view and timeline;
7. historical correction/editing;
8. tasks and task switching;
9. projects, contexts, tags, links, estimates;
10. focus/Pomodoro;
11. analytics;
12. export/import;
13. PWA/installability.

Correctness of levels 1–6 is more important than feature breadth below them.
