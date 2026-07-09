# HabitFlow — Feature & Improvement Tracker

> **Started:** 2026-07-09 · **Scope:** `apps/web`, `apps/api`, `apps/mobile`, monorepo DX.
> **How to use this doc:** A living to-do list. Tick `- [ ]` → `- [x]` as items ship. Keep each item one line; move detail into a linked design doc (e.g. [admin-access-control-plan.md](admin-access-control-plan.md), [mobile-audit-and-roadmap.md](mobile-audit-and-roadmap.md)) when it grows.
>
> **Legend:** Priority `P0` (now) · `P1` (next) · `P2` (later). Status ⬜ todo · 🟡 in progress · ✅ done · 🧊 parked.

---

## 🚀 New Features

| Status | Item           | Priority | Area         | Notes                                                  |
| ------ | -------------- | -------- | ------------ | ------------------------------------------------------ |
| ⬜     | Pomodoro timer | P1       | web / mobile | Focus timer (work/break cycles) as a productivity tool |
| ⬜     | To-do list     | P1       | web / mobile | Lightweight task list alongside habits                 |
| ⬜     | Stopwatch      | P2       | web / mobile | Simple count-up timer                                  |

### Checklist

- [ ] **Pomodoro timer** — configurable work/break intervals, start/pause/reset, session count
- [ ] **To-do list** — add / complete / delete tasks; decide if it persists via API or local-only
- [ ] **Stopwatch** — count-up timer with lap/reset

---

## ✨ Improvements

- [ ] **Add app/tool links on the `/` home page** _(P1, web)_ — surface Pomodoro / To-do / Stopwatch (and Habits) from the landing/home page so features are discoverable

---

## 🛠️ Infrastructure / Platform

- [ ] **Add Redis** _(P0 · high, api)_ — caching / session / rate-limit layer; confirm hosting (Render add-on) and wire into NestJS

---

## ✅ Done

_Move completed items here with the date, e.g. `- [x] 2026-07-09 — …`._

---

## 💡 Backlog / Ideas

_Unscheduled ideas. Promote to a section above once picked up._
