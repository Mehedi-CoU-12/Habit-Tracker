# HabitFlow — Feature & Improvement Tracker

> **Started:** 2026-07-09 · **Scope:** `apps/web`, `apps/api`, `apps/mobile`, monorepo DX.
> **How to use this doc:** A living to-do list. Tick `- [ ]` → `- [x]` as items ship. Keep each item one line; move detail into a linked design doc (e.g. [admin-access-control-plan.md](admin-access-control-plan.md), [mobile-audit-and-roadmap.md](mobile-audit-and-roadmap.md), [mobile-next-features-plan.md](mobile-next-features-plan.md)) when it grows.
>
> **Legend:** Priority `P0` (now) · `P1` (next) · `P2` (later). Status ⬜ todo · 🟡 in progress · ✅ done · 🧊 parked.

---

## 🚀 New Features

| Status | Item                | Priority | Area               | Notes                                                                                                     |
| ------ | ------------------- | -------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| ✅     | Pomodoro timer      | P1       | web / mobile       | Focus timer (work/break cycles) as a productivity tool                                                    |
| ⬜     | To-do list          | P1       | web / mobile       | Lightweight task list alongside habits                                                                    |
| ⬜     | Stopwatch           | P2       | web / mobile       | Simple count-up timer                                                                                     |
| ✅     | Quantifiable habits | P1       | api / web / mobile | Track counts & durations ("6 of 8 cups") — see [quantifiable-habits-plan.md](quantifiable-habits-plan.md) |

### Checklist

- [x] **Pomodoro timer** — configurable work/break intervals, start/pause/reset, session count
- [ ] **To-do list** — add / complete / delete tasks; decide if it persists via API or local-only
- [ ] **Stopwatch** — count-up timer with lap/reset
- [x] **Quantifiable habits** — daily `target` + `unit` on a habit, `amount` on a log; partial days show progress but don't extend streaks

### Next up — mobile (designed in [mobile-next-features-plan.md](mobile-next-features-plan.md))

- [ ] **Password reset** _(P0, api + web + mobile)_ — no forgot-password flow exists anywhere; a forgotten password is a permanently lost account
- [ ] **Onboarding actually plants the picked habits** _(P0, mobile)_ — `onboarding.tsx` discards the seeds and never writes `onboarded`; every new user lands on "Your garden is empty"
- [ ] **Account & security screen on mobile** _(P1, mobile)_ — wire the existing `PATCH /users/me` (name + password change); mobile can only change an avatar today
- [ ] **Reward moment** _(P1, mobile)_ — haptics, an animated plant, and a once-per-threshold milestone celebration; drop the unused reanimated/worklets deps
- [ ] **Data export** _(P1, mobile + api)_ — JSON + CSV to the share sheet; needs `GET /focus/sessions`. Deletion shipped without portability
- [ ] **Mobile in CI + crash reporting** _(P1, ci + all apps)_ — 16k lines with no enforced lint/types/tests, and no Sentry in any app

---

## ✨ Improvements

- [x] **`apps/mobile` has no `.prettierrc`** _(P1, DX)_ — it falls back to prettier's 2-space default, so root `pnpm format` reformats the entire mobile app (~11k lines) away from its 4-space style; fixed by copying `apps/web/.prettierrc` into `apps/mobile`
- [ ] **Add app/tool links on the `/` home page** _(P1, web)_ — surface Pomodoro / To-do / Stopwatch (and Habits) from the landing/home page so features are discoverable

---

## 🛠️ Infrastructure / Platform

- [ ] **Add Redis** _(P0 · high, api)_ — caching / session / rate-limit layer; confirm hosting (Render add-on) and wire into NestJS

---

## ✅ Done

_Move completed items here with the date, e.g. `- [x] 2026-07-09 — …`._

- [x] 2026-09-03 — **Quantifiable habits** _(api + web + mobile)_ — habits can now carry a daily `target`/`unit`/`step` and a log carries the `amount` actually done, so "6 of 8 cups" is a real state instead of a decorative subtitle. `Habit.target`/`unit`/`step` and `HabitLog.amount` are additive and defaulted, so the migration needs no backfill and every habit without a target stays binary and byte-identical. Completion is derived in one place per client (`src/lib/completion.ts`) rather than at the fourteen call sites that each equated "a log row exists" with "done". New `PUT /habits/logs/amount` (absolute + idempotent, so outbox replays converge); `toggleLog`/`setLog` write `amount: target` for a quantified habit and toggling a part-filled day fills to the target instead of discarding it. Mobile: progress-filling tap target with the sparkle on the tap that _reaches_ the target, an add/edit "Track a number" block, per-day amounts in the calendar, remainder-aware reminder copy, a `log.amount` outbox op, and partial days at heatmap level 1. Web: the same predicate, a target/unit/step block in `HabitModal`, and partial-fill grid cells. Partial days show progress but do **not** extend streaks or count toward the rate — see [quantifiable-habits-plan.md](quantifiable-habits-plan.md)
- [x] 2026-07-14 — **Pomodoro focus timer + session sounds** _(web + mobile)_ — Bloom "Focus" screen (focus/short/long cycles, 15/25/50 presets, timestamp-based countdown that survives reload, completing a session waters the habit) and a session-sound system (5 synthesized styles, start/end tones, on/off + volume picker). Web: `/focus` + `/focus/sound` (Web Audio engine in `src/lib/sound.ts`); mobile: `focus`/`sound` screens with baked WAV tones, keep-awake and background end-notification. Entry points: dashboard navbar + garden Focus pill (web); Today pill, habit detail, Settings (mobile)
- [x] 2026-07-14 — **Per-habit reminders on the edit page** _(mobile)_ — reminder toggle, preset + custom times, and a custom notification message ("Did you go to the office today?") now live on each habit's edit page; Settings keeps the master switch + quiet hours and links each habit to its edit page

---

## 💡 Backlog / Ideas

_Unscheduled ideas. Promote to a section above once picked up._

1. move the edit page and notification settings and the notification should be asked question
   i have ss in mobile
