# work/track

> A zero-dependency, single-file work time tracker that lives in your browser.

![Static Badge](https://img.shields.io/badge/stack-vanilla_html%2Fjs-00e5a0?style=flat-square)
![Static Badge](https://img.shields.io/badge/storage-IndexedDB-0088ff?style=flat-square)
![Static Badge](https://img.shields.io/badge/dependencies-none-ff6b35?style=flat-square)
![Static Badge](https://img.shields.io/badge/license-MIT-888?style=flat-square)

---

## What it does

A clean, keyboard-friendly time tracker built for developers who want to stay on top of their workday without spinning up a backend, signing up for a SaaS, or leaving the browser.

Everything runs in a single `worktracker.html` file. Data persists in IndexedDB — nothing leaves your machine.

---

## Features

### ⏱ Session Timer
- Start, pause, resume, and stop your work session
- Live progress bar toward an 8-hour goal, switches to **overtime counter** past 8h
- Editable session start time — forgot to start the tracker at 09:00? Fix it retroactively, worked time recalculates automatically

### 🍽 Lunch Break
- One-click 30-minute lunch countdown
- Auto-resumes your session when the break ends, or skip early

### 📋 Task Logging
- Start a named task with optional notes and category
- **Finish** logs the entry with start time, end time, and duration
- **Edit** any running or completed task — name, category, notes, and timestamps
- All entries stored and visible in Today's Log sidebar

### ⚡ Quick Tasks
- Interrupt the active task with a quick side-task
- Main task timer pauses automatically, resumes when the quick task is done

### 📆 History Views
- **Today tab** — full breakdown of the day with per-entry edit/delete
- **Week tab** — 7-day bar chart showing progress toward daily 8h goal, with past-day history
- Week total and average working hours

### ✓ Todos
- Add todos with optional due dates and notes
- Overdue items highlighted in red
- **Due today / tomorrow** shown directly in the tracker sidebar — check them off without switching tabs

---

## Getting started

No install. No build step. No server.

```bash
git clone https://github.com/your-username/worktrack.git
cd worktrack
open worktracker.html   # or xdg-open / just drag into Chrome
```

Pin the tab in Chrome for persistent access with the custom favicon.

---

## Stack

| What | How |
|---|---|
| UI | Vanilla HTML + CSS + JS |
| Fonts | IBM Plex Mono + IBM Plex Sans (Google Fonts) |
| Storage | Browser IndexedDB (survives restarts, no server needed) |
| Dependencies | None |
| Build tools | None |

---

## File structure

```
worktracker.html    # the entire app — one file
README.md
```

---

## Roadmap / ideas

- [ ] Configurable daily goal (beyond 8h)
- [ ] CSV / JSON export
- [ ] Dark/light theme toggle
- [ ] Desktop notifications for lunch end
- [ ] Optional backend sync (SQLite via small local server)
- [ ] Keyboard shortcuts

PRs and issues welcome.

---

## License

MIT
