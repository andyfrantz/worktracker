# WorkTrack v2 — Implementation Issues

This backlog translates `PROJECT.md`, `ARCHITECTURE.md`, and `AGENTS.md` into implementation issues. Work in order unless an issue says otherwise. Domain correctness takes priority over UI polish.

## Working rules

- Read `PROJECT.md`, `ARCHITECTURE.md`, and `AGENTS.md` first.
- One issue should normally produce one focused commit/PR.
- Add tests with behavioral changes.
- The canonical timeline is the source of truth for worked time.
- UI code must not independently calculate worked time.
- Do not add backend, auth, sync, Jira APIs, or generic project-management scope without a new architecture decision.

# Milestone 0 — Foundation

## Issue 001 — Bootstrap WorkTrack v2

**Goal:** Create the minimal app with Svelte, TypeScript, Vite, Dexie, Vitest, and Playwright.

**Work:** Configure development/build/typecheck/test/E2E/lint scripts. Establish `src/domain`, `src/db`, `src/services`, `src/components`, `src/views`, and `tests/e2e`. Keep the root project docs.

**Acceptance criteria:** `npm install`, dev server, production build, typecheck, unit tests, and one Playwright smoke test all succeed. No backend or unnecessary state/UI framework is introduced.

## Issue 002 — Define core domain types

**Goal:** Establish the vocabulary before database/UI work.

**Work:** Define framework-independent types for Context, Project, Task, Tag, TaskTag, TaskLink, TimeSegment, and FocusSession. `TimeSegment.kind` is `work | break | lunch`. Work may have an optional task. Store absolute timestamps.

**Acceptance criteria:** Domain types import neither Svelte nor Dexie. Tasks support initial/current estimates. Context target and lunch are configurable/optional.

## Issue 003 — Implement timeline invariants

**Goal:** Prevent invalid time history.

**Work:** Pure validation/manipulation functions. Closed segment end must be after start; only one segment may be open; no global overlap; edits/inserts must preserve these rules.

**Acceptance criteria:** Unit tests cover adjacent, overlapping, nested, zero/negative, duplicate-start, open-segment, and invalid-edit cases.

# Milestone 1 — Time Engine

## Issue 004 — Calculate worked time

**Goal:** Make work segments the sole source of worked duration.

**Work:** Sum only `work` segments intersecting a requested period. Open segments use an injected `now`. Correctly clip segments at reporting boundaries.

**Acceptance criteria:** Tests cover closed/open work, breaks, lunch, unassigned work, no work, and midnight-crossing segments.

## Issue 005 — Calculate remaining work and overtime

**Goal:** Derive target progress.

**Work:** From context target + worked duration derive remaining, overtime, and target-reached state. Contexts without a target return no-target semantics.

**Acceptance criteria:** Tests cover zero, under, exact, over, and no-target cases.

## Issue 006 — Calculate expected finish

**Goal:** Answer “When am I probably done today?”

**Work:** Derive, never store, expected finish as `now + remaining work + still-expected future lunch`. Past breaks already advanced wall time and must not be added again. Before lunch, configured lunch is an assumption; after actual lunch exists, reality replaces that assumption. Support “skip planned lunch today.”

**Acceptance criteria:** Tests include 08:00 + 8h + 30m = 16:30; ordinary breaks; 42m actual lunch; 20m actual lunch; skipped lunch; overtime; no-target context.

## Issue 007 — Implement workday transitions

**Goal:** Represent controls as timeline changes, not counters.

**Work:** Start creates open work. Historical start uses supplied time. Pause closes work and opens break. Resume closes break/lunch and opens work. Lunch closes work and opens lunch. Stop closes the open segment. Use exact shared boundary timestamps.

**Acceptance criteria:** Invalid transitions are rejected; no gaps/overlaps are accidentally created; stop leaves no open segment.

## Issue 008 — Implement timeline corrections

**Goal:** Safely fix real-life mistakes.

**Work:** Support editing boundaries, inserting forgotten segments, changing kind, deleting, splitting, and merging compatible adjacent segments. Never use correction offsets or manually patched totals.

**Acceptance criteria:** Corrections automatically change derived totals/finish time and cannot create overlap.

## Issue 009 — Define sleep/wake recovery

**Goal:** Never silently classify inactivity.

**Work:** Open work continues through reload/sleep. Detect suspicious wall-clock jumps only to offer a correction. A user may split the interval and mark part as break.

**Acceptance criteria:** Sleep counts as work by default; detection does not mutate data; approved correction does.

# Milestone 2 — Persistence

## Issue 010 — Create Dexie schema and migrations

**Goal:** Persist all canonical data locally.

**Work:** Versioned tables/indexes for contexts, projects, tasks, tags, taskTags, taskLinks, timeSegments, focusSessions, and minimal settings/meta.

**Acceptance criteria:** Clean initialization and reload persistence work. Domain code remains Dexie-independent. Useful queries are indexed.

## Issue 011 — Implement repositories and atomic timeline transitions

**Goal:** Make state changes crash-safe.

**Work:** Repository queries for current open segment, date/range, task, and context. Multi-record transitions use Dexie transactions. Validate before persistence.

**Acceptance criteria:** Reload restores state; half-transitions cannot persist; integration tests cover core repository operations.

## Issue 012 — Seed first-run Work context

**Goal:** Make first launch immediately useful.

**Work:** Create default Work context once with 8h target and 30m planned lunch. Decide/document whether Personal is seeded targetless or user-created.

**Acceptance criteria:** Fresh install can immediately start tracking without setup.

# Milestone 3 — Core Workday UI

## Issue 013 — Build the main workday screen

**Goal:** Restore the original one-screen purpose.

**Work:** Prominently show context, status, worked, remaining, expected finish, progress, and Start/Pause/Resume/Lunch/Stop. Avoid the old collection-of-cards layout.

**Acceptance criteria:** The screen immediately answers “Am I working?”, “How much have I worked?”, and “When am I done?” UI uses domain calculations only and is responsive/accessibly operable.

## Issue 014 — Add “started earlier”

**Goal:** Count work done before opening WorkTrack.

**Work:** One-click Start now plus low-friction N-minutes-ago/exact-time alternatives.

**Acceptance criteria:** Historical start creates the actual historical segment; overlaps are rejected; finish prediction updates immediately.

## Issue 015 — Build today timeline

**Goal:** Make the day the central history surface.

**Work:** Chronological visualization of work/break/lunch/open segments with task/project metadata and unassigned work.

**Acceptance criteria:** Display exactly matches stored boundaries; open segments continue to now; midnight clipping is correct.

## Issue 016 — Add timeline editing UI

**Goal:** Repair history without database concepts.

**Work:** Edit start/end/type, delete, insert, split, merge. Add drag resize only if it remains simple; precise accessible editing comes first.

**Acceptance criteria:** Invalid overlap cannot save; derived values update immediately; unrelated segments are untouched.

## Issue 017 — Add planned-lunch controls

**Goal:** Make finish prediction explainable.

**Work:** Show when planned lunch is included. Support Start lunch, End lunch, and Skip planned lunch today.

**Acceptance criteria:** User can understand why the predicted finish has its current value.

# Milestone 4 — Contexts, Projects, Tasks, Tags, Links

## Issue 018 — Context management

**Goal:** Support Work and Personal cleanly.

**Work:** Create/edit/archive contexts with optional daily target and planned lunch. Only one context may actively track time globally.

**Acceptance criteria:** Work and Personal can have different/no targets; parallel active contexts are impossible; reports filter by context.

## Issue 019 — Project management

**Goal:** Group tasks without becoming a project-management suite.

**Work:** Lightweight context-owned projects with name, optional description, archive/unarchive. Tasks may remain projectless.

**Acceptance criteria:** Create/select/rename/archive/filter works without kanban/sprints/subtasks/dependencies.

## Issue 020 — Persistent tasks replace todos

**Goal:** Unify planning and tracked work.

**Work:** Task fields: title, context, optional project, notes, status, initial/current estimate, tags, links. Provide a lightweight open-task queue.

**Acceptance criteria:** Tasks exist before tracking, span segments/days, preserve history after completion, and can reopen. No separate Todo model exists.

## Issue 021 — Implement task switching

**Goal:** Change activity without changing work accounting.

**Work:** Switching A→B closes the current work segment at T and opens a new work segment at exactly T assigned to B. Support Unassigned and remember previous task.

**Acceptance criteria:** No gap/overlap; total worked time is unchanged; task actuals update correctly. No special Quick Task state exists.

## Issue 022 — Fast task entry/switching

**Goal:** Make interruptions cheap.

**Work:** Keyboard-first search/create/switch interaction, including resume previous task and unassigned work. Avoid a large command-palette dependency.

**Acceptance criteria:** A new interruption can be started in a few keystrokes and the previous task resumed quickly.

## Issue 023 — Managed tags with autocomplete

**Goal:** Eliminate category typos.

**Work:** Central tag manager, normalized unique names, archive/unarchive, optional subtle color. Autocomplete existing tags and intentionally create new ones.

**Acceptance criteria:** `meeting`, `Meeting`, and whitespace variants cannot silently become duplicates.

## Issue 024 — Generic task links

**Goal:** Support Jira without Jira coupling.

**Work:** Multiple URL + optional-label links per task. Nicely recognize obvious Jira/GitHub URLs only as presentation enhancement.

**Acceptance criteria:** Jira and arbitrary URLs both work. No Jira auth/API integration.

# Milestone 5 — Estimation

## Issue 025 — Estimate vs actual domain logic

**Goal:** Improve personal estimation skill.

**Work:** Preserve `initialEstimateMinutes`; allow `currentEstimateMinutes` changes. Actual = sum of all work segments assigned to task. Derive delta and percentage variance safely.

**Acceptance criteria:** 120m estimate + 138m actual = +18m / +15%; changing current estimate never overwrites initial estimate.

## Issue 026 — Estimate vs actual task UI

**Goal:** Make feedback useful but unobtrusive.

**Work:** Show initial/current estimate, actual, and variance in task details/history with neutral under/on/over language.

**Acceptance criteria:** Tasks without estimates remain clean; completed and ongoing tasks show appropriate data.

## Issue 027 — Estimation analytics

**Goal:** Reveal systematic estimation bias.

**Work:** Derived average/median actual-to-initial ratio, over-estimate frequency, and breakdowns by project/tag/time range where sample size is meaningful.

**Acceptance criteria:** Missing/zero estimates are safe; small samples avoid misleading precision; context filtering works.

# Milestone 6 — Focus / Pomodoro

## Issue 028 — Independent focus-session domain

**Goal:** Restore Pomodoro without corrupting work time.

**Work:** FocusSession supports planned duration, start/end/status, optional task, and pause/resume/cancel/complete semantics as needed.

**Acceptance criteria:** Unit tests prove every focus operation leaves worked-time calculation unchanged.

## Issue 029 — Compact focus timer UI

**Goal:** Help focus without becoming another dominant dashboard.

**Work:** Secondary focus control with presets, countdown, phase controls, optional notifications, and defined reload recovery.

**Acceptance criteria:** Focus works while tracking, never alters work segments, and notification denial/failure is harmless.

# Milestone 7 — Review

## Issue 030 — Daily review

**Goal:** Understand and clean up a day.

**Work:** Show total/target/overtime, start/end, breaks/lunch, timeline, task allocation, unassigned work, project/tag summaries.

**Acceptance criteria:** Every total reconciles with canonical segments.

## Issue 031 — Weekly review

**Goal:** Show useful patterns without enterprise-dashboard bloat.

**Work:** Per-day worked/target, weekly total, overtime/under-target, project/tag allocation, context filtering.

**Acceptance criteria:** Local calendar boundaries and midnight-crossing allocation are correct.

## Issue 032 — Estimation review

**Goal:** Connect history to estimation learning.

**Work:** Add aggregate estimate-vs-actual information and drill-down to contributing tasks.

**Acceptance criteria:** User can answer “How far off were my estimates recently?”

# Milestone 8 — Settings and Data Safety

## Issue 033 — Settings UI

**Goal:** Give infrequent configuration one predictable home.

**Work:** Manage contexts/targets/lunch, focus presets, tags, projects, theme, and data tools. Keep daily actions out of Settings.

**Acceptance criteria:** Configuration is centralized without becoming a giant settings system.

## Issue 034 — Versioned JSON export

**Goal:** Never trap local history in IndexedDB.

**Work:** Export contexts, projects, tasks, tags, links, segments, focus sessions, and relevant settings with explicit export/schema version.

**Acceptance criteria:** Complete backup downloads and is inspectable/documented.

## Issue 035 — Validated transactional import

**Goal:** Restore backups safely.

**Work:** Validate JSON/version/records/IDs/timeline overlap before mutation. Restore transactionally.

**Acceptance criteria:** Export→clear→import recreates equivalent data; invalid import cannot partially corrupt current data.

## Issue 036 — CSV export

**Goal:** Allow external analysis.

**Work:** Export useful flat datasets such as time segments and task estimate/actual summary.

**Acceptance criteria:** CSV opens cleanly in common spreadsheet tools with documented columns.

# Milestone 9 — Reliability and UX Quality

## Issue 037 — Reload/crash recovery E2E tests

**Goal:** Prove local-first tracking survives browser lifecycle.

**Work:** Test work, lunch, task assignment, focus recovery, and stopped state across reload.

**Acceptance criteria:** Stable non-flaky Playwright flows pass.

## Issue 038 — Critical workday E2E suite

**Goal:** Protect defining behavior.

**Work:** Cover start now, start earlier, pause/resume, long lunch, skip lunch, task switch, correction, estimate variance, Work→Personal, export/import.

**Acceptance criteria:** Tests assert user-visible results and run in the normal verification workflow.

## Issue 039 — Keyboard/accessibility pass

**Goal:** Make an all-day utility efficient without a mouse.

**Work:** Semantic controls, labels, focus management, dialogs, task switching, visible focus, contrast, screen-reader naming, reduced motion.

**Acceptance criteria:** Core tracking, switching, and editing can be completed keyboard-only.

## Issue 040 — Responsive pass

**Goal:** Remain useful on narrow screens.

**Work:** Review main screen, timeline, picker, settings, history. Do not build a separate mobile app.

**Acceptance criteria:** No core operation is inaccessible/broken at typical phone width.

## Issue 041 — Long-history performance pass

**Goal:** Keep years of data responsive.

**Work:** Test thousands of segments/tasks; measure IndexedDB queries, aggregation, rendering, and reactive recomputation. Optimize measured bottlenecks only.

**Acceptance criteria:** Daily/weekly use remains responsive with a realistic large dataset.

# Milestone 10 — PWA and Release

## Issue 042 — PWA installability/offline shell

**Goal:** Make the stable browser app installable.

**Work:** Manifest, icons, metadata, offline application-shell caching. IndexedDB remains canonical storage.

**Acceptance criteria:** Supported browsers can install it and reopen the cached shell/data offline.

## Issue 043 — Safe application updates

**Goal:** Avoid disrupting an active workday.

**Work:** Notify about new versions rather than force-reloading an active app. Define activation behavior.

**Acceptance criteria:** Updates cannot silently interrupt persisted tracking or discard in-progress UI edits.

## Issue 044 — Static production deployment

**Goal:** Deploy with minimal infrastructure.

**Work:** Configure chosen static host and pre-deploy build/test checks.

**Acceptance criteria:** HTTPS static app works without runtime backend.

## Issue 045 — v2 release checklist

**Goal:** Define release readiness.

**Work:** Checklist for tests, schema/migrations, export/import, accessibility, responsive behavior, offline/PWA, fresh install, upgrade, docs, known limitations.

**Acceptance criteria:** Human or agent can make a clear release/no-release decision.

# Explicitly Deferred / Post-v2

Create new architecture decisions/issues before implementing these:

- Jira API/auth integration.
- GitHub/Linear API integrations.
- Cross-device/cloud sync.
- Automatic idle-time classification.
- Advanced timeline drag editing if precise editing is sufficient.
- AI summaries/classification.
- Advanced forecasting/ML estimation.
- Team collaboration, assignments, kanban, sprints, subtasks, dependencies.

# Critical path

```text
001 → 002 → 003
            ↓
004 → 005 → 006 → 007 → 008 → 009
 ↓                         ↓
010 → 011 → 012 ─────────→ 013 → 014 → 015 → 016 → 017
                                      ↓
018 → 019 → 020 → 021 → 022 → 023 → 024
                  ↓
025 → 026 → 027
                  ↓
028 → 029
                  ↓
030 → 031 → 032
                  ↓
033 → 034 → 035 → 036
                  ↓
037 → 038 → 039 → 040 → 041
                  ↓
042 → 043 → 044 → 045
```

# v2 definition of done

WorkTrack v2 is successful when the user can:

1. Use it with no login or network dependency.
2. Start work now or retroactively.
3. Always see trustworthy worked time, remaining time, and expected finish.
4. Pause, resume, lunch, and correct mistakes without corrupting totals.
5. Track legitimate work without naming a task.
6. Optionally organize work into persistent tasks/projects.
7. Switch tasks without affecting total worked time.
8. Use managed tags and Jira/other links.
9. Compare initial estimates with actual effort.
10. Use an independent Pomodoro/focus timer.
11. Keep Work and Personal contexts separate.
12. Review daily/weekly history.
13. Export and restore all important local data.
14. Survive reload/sleep and work offline without losing the canonical timeline.
15. Do all of this without becoming a generic project-management suite.
