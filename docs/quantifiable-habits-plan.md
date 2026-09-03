# HabitFlow — Quantifiable Habits (counts & durations): Design Plan

> **Generated:** 2026-09-03 · **Scope:** `apps/api` (model + write path), `apps/mobile` (primary surface), `apps/web` (parity) · **Status:** Phases 1–6 landed. Only Phase 7 (ship) is outstanding. The feature works end to end on both clients.
> **How to use this doc:** Sections 1–6 are the design with decisions and rationale. Section 7 is the execution plan in implementation order — tick the `- [ ]` boxes as you complete them. Section 8 is the verification matrix to run before calling it done.

> **Headline:** The app already _promises_ quantities and doesn't keep the promise. `Habit.verb` is a free-text subtitle rendered at [HabitRow.tsx:165](../apps/mobile/src/components/HabitRow.tsx#L165), and the built-in templates seed it with `"8 cups"`, `"30 min"`, `"20 pages"`, `"10k steps"` — but `HabitLog` is existence-only, so a user who drinks 3 of 8 cups has exactly two choices: lie and tick it, or lose the day. This plan adds two nullable columns to `Habit` and one defaulted column to `HabitLog`, which needs **no backfill** and leaves every existing habit binary. The hard part is not the schema — it is that **fourteen separate call sites** across the two clients equate "a log row exists" with "the day is complete", and all of them must move behind one shared predicate.

---

## 1. Where the code stands today (recon facts the design is built on)

**Data model** ([schema.prisma](../apps/api/prisma/schema.prisma)):

- `Habit` has `goal Int` — a **monthly** count of days (validated `1..31`), _not_ a daily amount. `verb String?` is free text, max 50 chars, purely decorative.
- `HabitLog` is `@@unique([habitId, year, month, day])` with no payload column. The row's existence _is_ the completion.
- Latest migration is `20260902095735_habit_schedule_archive_day_notes`. Render runs `prisma migrate deploy` at every boot, so merging a migration to `main` auto-applies it in production.

**API** ([habits.service.ts](../apps/api/src/habits/habits.service.ts)):

- Two write paths: `POST /habits/logs/toggle` (relative flip, used by online clients) and `PUT /habits/logs` (absolute `completed: boolean`, used by the offline outbox so replays converge).
- Reads are Redis-cached per `(user, month)` under a version key; every mutation calls `invalidateHabits`.
- Global `ValidationPipe({ whitelist, forbidNonWhitelisted })` — **any new DTO field must be decorated or the request is rejected.**

**The fourteen completion-derivation sites.** Each independently decided "done" from a log row's mere presence. Phase 1 routed every one through `lib/completion.ts`; the list is what the type-checker confirmed, not what the first read-through found (four were missed by eye).

| #   | File                                                           | What it computes                                |
| --- | -------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `apps/mobile/src/lib/deriveStats.ts` `deriveHabitStats`        | `completedDays` → streak, best, rate, doneToday |
| 2   | `apps/mobile/src/lib/deriveStats.ts` `deriveRangeStats`        | `doneDays` for the Insights periods             |
| 3   | `apps/mobile/src/lib/heatmap.ts` `collectHabitDays`            | per-habit heatmap depth                         |
| 4   | `apps/mobile/src/lib/heatmap.ts` `buildActivityHeatmap`        | activity heatmap fraction                       |
| 5   | `apps/mobile/src/notifications/reminders.ts` `readHabits`      | `doneToday` → whether to nudge                  |
| 6   | `apps/mobile/src/notifications/reminders.ts` `markDoneInCache` | the "Mark done" notification action             |
| 7   | `apps/mobile/src/api/hooks.ts` `useToggleLog`                  | optimistic toggle                               |
| 8   | `apps/mobile/src/app/(tabs)/calendar.tsx` `perDay`             | month-grid completion rings                     |
| 9   | `apps/mobile/src/app/(tabs)/calendar.tsx` day list             | day-cell tick state                             |
| 10  | `apps/mobile/src/app/focus.tsx` `isDoneToday`                  | whether a finished session waters the habit     |
| 11  | `apps/web/src/lib/deriveStats.ts`                              | the same maths as #1, duplicated                |
| 12  | `apps/web/app/dashboard/useDashboard.ts`                       | flattens API logs to `HabitLog.completed`       |
| 13  | `apps/web/app/focus/page.tsx` `waterMutation`                  | optimistic water                                |
| 14  | `apps/web/app/focus/page.tsx` `waterHabit`                     | water guard                                     |

`apps/web/components/habits/HabitRow.tsx` reads the flattened `HabitLog.completed` produced by #12, so it needs no change of its own.

One deliberate non-site: `buildActivityHeatmap` also scans logs to find a habit's earliest activity. That is planting evidence, not completion, so it keeps reading every log — Phase 1 split it into its own loop so Phase 3 cannot silently narrow it.

**Offline** ([outbox.ts](../apps/mobile/src/offline/outbox.ts)): a durable, coalescing, ordered queue. `log.set` supersedes any earlier queued write for the same `(habit, date)` cell but never the in-flight one. [sync.ts](../apps/mobile/src/offline/sync.ts) dispatches by `kind` with an `assertNever` exhaustiveness guard — a missing case is a compile error _and_ a runtime throw, which the comment notes already caught a dropped write once.

---

## 2. Key design decisions

- **D1 — `target` on the habit, `amount` on the log.** `Habit.target Int?` is the daily goal (8); `HabitLog.amount Int @default(1)` is what was actually done. A day is complete when `amount >= (target ?? 1)`. Existing rows default to `amount = 1` and existing habits have `target = null`, so `1 >= 1` — **every historical day stays complete, with no backfill script.** This is the single property that makes the migration safe on production data.

- **D2 — `target = null` means binary, and binary stays byte-identical.** A habit without a target keeps the current tick UI, the current write path, and the current maths. Quantification is strictly additive; there is no "convert everything" moment and no flag day.

- **D3 — One shared predicate, not eight.** Introduce `isDayComplete(target, amount)` in `lib/schedule.ts`'s sibling position (a new `lib/completion.ts`) and route all eight sites through it. **Do this refactor first, as a no-op change, before any behaviour depends on it** — it is mechanical, individually verifiable, and if it is done last instead the feature lands with silent holes in the reminder and heatmap paths.

- **D4 — A new sibling endpoint, not an overloaded one.** `PUT /habits/logs/amount` rather than bolting `amount?` onto `SetLogDto`. Reasons: (a) `{ completed: true, amount: 3 }` against a target of 8 is a self-contradicting payload and the validation to forbid it is worse than a second route; (b) `AppRelease.minimum` exists and you support older installs — an untouched `PUT /habits/logs` means every shipped client keeps working with zero risk; (c) the outbox coalescing rule is per-cell and per-kind, so a distinct `log.amount` kind is cleaner to supersede.

- **D5 — Streaks stay strict; partial days get visual credit only.** `amount = 3/8` does **not** extend a streak and does **not** count toward `rate`. Partial credit in the streak maths is a semantics rabbit-hole (is 7/8 a streak day? 4/8?) that every competitor answers differently and none answers well. Partial progress instead shows as a lighter heatmap level — the grid already has a level scale (`fracToLevel`/`depthToLevel`), so this is nearly free.

- **D6 — `goal` and `target` are different axes and the UI must say so.** `goal` = "20 days this month". `target` = "8 cups a day". These are trivially confused. The add/edit form gets them in visually separate blocks with explicit copy, never adjacent steppers.

- **D7 — `verb` survives as-is.** For a quantified habit the subtitle renders from `target`+`unit`; for a binary one it keeps rendering `verb`. Dropping `verb` would mean a migration, a template rewrite, and breaking older clients for no gain.

- **D9 — `toggleLog` is target-aware, not existence-aware.** Found while implementing Phase 2. The old rule was "a row exists ⇒ delete it", which on a part-filled day (3 of 8 cups) throws the 3 away — the opposite of what tapping a tick means. The rule is now "delete only if the day already counts as complete, otherwise fill to the target". For a binary habit (`target ?? 1`) this is bit-for-bit the old behaviour, verified by test and against a live database. It matters because an older client, which cannot know about targets, can still reach this endpoint on a multi-device account.

- **D8 — Do not extract `@repo/core` as part of this.** `deriveStats` is duplicated across web and mobile and the audit already flags that it has diverged; this change touches both copies. Extracting the shared package is the right call, but bundling a cross-app refactor into a schema-changing feature makes both harder to review and to revert. Land this feature in both copies, then extract. (Note the current branch, `fix-web/schedule-archive-parity`, is fighting exactly this duplication — so sequence the extraction right after.)

---

## 3. Data model changes (Prisma)

```prisma
model Habit {
  // …existing fields…

  /// Daily target amount, e.g. 8 (cups). Null = a binary done/not-done habit,
  /// which is every habit predating this column — so the migration needs no
  /// backfill. Distinct from `goal`, which counts DAYS per month.
  target Int?
  /// Unit label for `target`, e.g. "cups", "min", "pages". Null when binary.
  unit   String?
  /// How much one tap adds — 1 for cups, 10 for minutes.
  step   Int     @default(1)
}

model HabitLog {
  // …existing fields…

  /// How much was done that day. 1 is what every pre-existing row means, so
  /// the default backfills them to "complete" against a null target.
  amount Int @default(1)
}
```

Migration name: `20260903xxxxxx_quantifiable_habits`. Both `Habit` columns are nullable and `HabitLog.amount` is defaulted, so the migration is a pure `ALTER TABLE ADD COLUMN` — no table rewrite, no data step, and safe to apply on boot.

**Validation** (`create-habit.dto.ts` / `update-habit.dto.ts`), remembering `forbidNonWhitelisted`:

- `target?: number` — `@IsOptional() @IsInt() @Min(1) @Max(10000)`
- `unit?: string` — `@IsOptional() @IsString() @Transform(trim) @MaxLength(16)`
- `step?: number` — `@IsOptional() @IsInt() @Min(1) @Max(1000)`
- Cross-field: `unit` and `step` are meaningless without `target`. Normalize rather than reject — when `target` is absent or null, null out `unit` and reset `step` to 1, so a client can un-quantify a habit with `{ target: null }` in one PATCH.

---

## 4. API changes (`apps/api`)

**New endpoint** — `PUT /habits/logs/amount`, `SetLogAmountDto`:

```ts
{
    habitId: string;
    year: number;
    month: number;
    day: number;
    amount: number;
}
```

with the same `@Min(2000)/@Max(2100)`, `1..12`, `1..31` bounds as `SetLogDto`, and `amount` as `@IsInt() @Min(0) @Max(100000)`.

Semantics — absolute and idempotent, so an outbox replay converges:

- `amount <= 0` → `deleteMany` the cell (clearing an absent cell is a no-op).
- `amount > 0` → `upsert` with `update: { amount }`.
- Returns `{ amount, completed }` where `completed = amount >= (habit.target ?? 1)`, so the client does not have to re-derive it from a stale habit.
- Ownership check and `invalidateHabits(userId)` exactly as `setLog` does today.

**`toggleLog` and `setLog` change behaviour in one narrow way:** when they create a row for a habit that _has_ a target, they must write `amount: target`, not the default `1` — otherwise "tick it done" on an 8-cup habit records 1 cup and reads back as incomplete. This is the one easy-to-miss edit in the whole API phase.

**`applyTemplate`** — seed `target`/`unit` on the templates whose `verb` is already a quantity (`"8 cups"` → `target: 8, unit: "cups"`; `"30 min"` → `target: 30, unit: "min", step: 5`). New users then meet the feature on day one instead of discovering it in a form.

---

## 5. Mobile changes (`apps/mobile`)

**`src/lib/completion.ts`** (new) — the D3 predicate, plus the display helpers:

```ts
export function isDayComplete(target: number | null, amount: number): boolean;
export function completedDaysOf(h: ApiHabit): Set<number>; // replaces `new Set(h.logs.map(l => l.day))`
export function progressLabel(h): string; // "6 / 8 cups"
```

`completedDaysOf` is the seam: sites 1, 3, 4, 5, 6, 7 and 8 all become one call.

**`deriveStats.ts`** — swap line 45 for `completedDaysOf(h)`. Everything downstream (streak, best, rate, `doneToday`) then works unchanged, per D5. Add to `HabitWithStats`: `target`, `unit`, `step`, and `todayAmount` for the row UI.

**Today screen / `HabitRow`** — a quantified row replaces the tick with a progress ring plus a `+` stepper:

```
┌──────────────────────────────────┐
│ 💧 Drink water                   │
│ ███████░░░  6 / 8 cups      [+]  │
│ 🔥 12 day streak                 │
└──────────────────────────────────┘
```

Tap `+` adds `step`. Long-press opens numeric entry (reuse the `goalDraft` digit-filtering pattern already in [add.tsx:157](../apps/mobile/src/app/add.tsx#L157)). Crossing the target fires the existing `Sparkles` reward — the payoff moment must be the _target_, not the first tap.

**`add.tsx`** — a "Track a number" block: toggle on → target stepper + unit text input + step stepper. Keep it visually separate from the monthly `goal` block (D6). Polish: when the block is switched on and `verb` matches `/^(\d+)\s*(.+)$/`, prefill `target`/`unit` from it — a user whose habit already says "8 cups" gets it converted in one tap.

**`calendar.tsx`** — the day-detail row shows `amount / target` and, for quantified habits, opens the stepper instead of toggling.

**`reminders.ts`** — site 5's `doneToday` goes through the predicate, and `markDoneInCache` (site 6) must write `amount: target ?? 1`, not just push a bare log row. Reminder copy can then read "6 of 8 cups — 2 to go".

**Offline** — new outbox op:

```ts
| { kind: "log.amount"; habitId: string; year: number; month: number; day: number; amount: number }
```

Three edits that are each easy to forget:

1. `enqueue` — coalesce per `(habit, date)` like `log.set`, and make `log.set` and `log.amount` supersede **each other** for the same cell, not just their own kind. A user can tick and then step the same day.
2. `touchesHabit` — must return `true` for `log.amount`, or `habit.delete` will leave orphaned ops that 404 forever.
3. `dispatch` in `sync.ts` — add the case. The `assertNever` guard catches the omission, but only at runtime on a real user's queue.

**Reward** — `Plant.tsx` currently stages on `streak` alone. Optionally let a partially-watered plant render at reduced `dim` (between the current `0.5` and `1`) so today's progress is visible in the garden.

---

## 6. Web changes (`apps/web`)

Parity, no new concepts:

- Mirror `completion.ts` and the `deriveStats.ts:28` swap.
- `app/dashboard/types.ts` — the flattened `HabitLog` gains `amount: number`; `completed` stays as the derived boolean so [HabitRow.tsx:40](../apps/web/components/habits/HabitRow.tsx#L40) keeps working, now fed by the predicate.
- `HabitModal` — the same target/unit/step block as mobile.
- `HabitGrid` — a partial day renders as a partial-fill cell rather than empty; this is where D5's "visual credit only" actually shows up on web.
- `lib/api.ts` — add `setLogAmount`.

---

## 7. Execution plan (implementation order)

### Phase 1 — The no-op refactor (do this first, ship it separately) ✅

- [x] Add `apps/mobile/src/lib/completion.ts` with `completedLogs` / `completedDaysOf` / `isDayComplete`, on today's binary rule
- [x] Route all fourteen sites through it — **no behaviour change**; mobile 79 tests and web 15 pass untouched, both apps type-check
- [x] Mirror on web (`apps/web/src/lib/completion.ts`)
- [ ] Commit on its own so the behavioural phases have a clean diff

### Phase 2 — Data model & API (`apps/api`) ✅

- [x] Prisma: `Habit.target/unit/step`, `HabitLog.amount` — migration `20260903112032_quantifiable_habits` is `ADD COLUMN`-only, applied locally
- [x] DTO fields + the `target: null` → `unit: null, step: 1` normalization (in the service, where the write happens)
- [x] `SetLogAmountDto` + `PUT /habits/logs/amount` in controller and service
- [x] `toggleLog`/`setLog` write `amount: target` when the habit is quantified, and `toggleLog` is now target-aware (see D9)
- [x] Seed `target`/`unit` on the quantity-bearing templates (`6:00am` and `morning pages` stay binary — they are not amounts)
- [x] Jest: 32 tests pass — DTO validation, the `amount <= 0` delete path, replay idempotency, `completed` derivation, binary regression
- [x] Smoke-tested against a live API + Postgres: replay converges to one row, `0` clears, partial toggle fills, binary habits unchanged

### Phase 3 — Mobile core ✅

- [x] `completion.ts` on the real rule (`amount >= target ?? 1`); `HabitWithStats` carries `target`/`unit`/`step`/`todayAmount`
- [x] `useSetLogAmount` hook — optimistic, outbox-backed, clamped at 0
- [x] `completion.test.ts` in both clients: partial breaks a streak, exceeding the target counts once, an amount-less row still completes (the pre-migration cache case)

### Phase 4 — Mobile offline ✅

- [x] `log.amount` op kind, with `log.set` and `log.amount` superseding **each other** per cell
- [x] `touchesHabit` and `dispatch` cases (the `assertNever` guard covers the latter)
- [x] Endpoint + payload types threaded through `endpoints.ts` and `outbox.ts`

### Phase 5 — Mobile UI ✅

- [x] `HabitRow`: the check circle fills bottom-up with progress and becomes a `+` stepper; the sparkle fires on the tap that _reaches_ the target
- [x] `add.tsx`: a "Track a number" block, kept visually apart from the monthly goal (D6), seeding target/unit from a `verb` that already reads like one
- [x] `calendar.tsx`: per-day amount, proportional fill, tap to step / clear when full
- [x] `reminders.ts`: `markDoneInCache` raises an existing partial row instead of appending a second, and the copy can say "3 cups to go"
- [x] Heatmap: partial days take level 1 (previously unused) so progress shows without reading as done

### Phase 6 — Web parity ✅

- [x] `completion.ts`, `deriveStats`, and `amount` on the flattened log
- [x] `HabitModal` target/unit/step block, `HabitGrid` partial-fill cell, `setLogAmount` in `lib/api.ts`
- [x] `completion.test.ts` mirrored from mobile

### Phase 7 — Ship

- [ ] Bump `apps/mobile` version; publish an `AppRelease` (leave `minimum` alone — old clients are unaffected by D4)
- [ ] Tick the row in [features-or-bugDoc.md](features-or-bugDoc.md)

---

## 8. Verification matrix

| #   | Scenario                                               | Expected                                                                                    |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | Existing habit, existing logs, after migration         | Identical streak/best/rate to before — **the migration's whole safety claim**               |
| 2   | Binary habit, tick and untick                          | Unchanged; `PUT /habits/logs` never sees `amount`                                           |
| 3   | Quantified 8-cup habit, step to 3                      | Row exists, `amount = 3`, day **not** complete, streak breaks                               |
| 4   | …step to 8                                             | Complete, sparkle fires, streak extends                                                     |
| 5   | …step to 12                                            | Complete, `rate` never exceeds 100%                                                         |
| 6   | Quantified habit, tick from the calendar's binary path | `amount = target`, not 1 — ✅ verified live                                                 |
| 6b  | Toggle a part-filled day (5 of 8)                      | Fills to 8, row kept; toggling again clears — ✅ verified live                              |
| 7   | Replay `PUT /logs/amount` three times                  | One row, final amount, no duplicate                                                         |
| 8   | Offline: five steps, then reconnect                    | One request, final amount                                                                   |
| 9   | Offline: step, then delete the habit                   | No orphaned op, no 404 wedge                                                                |
| 10  | Reminder for a partially-done habit                    | Still fires; copy reflects the remainder                                                    |
| 11  | `PATCH { target: null }` on a quantified habit         | Reverts to binary; `unit` cleared, `step` 1; past logs keep their amounts and stay complete |
| 12  | Web and mobile, same account, same month               | Byte-identical streak/best/rate                                                             |

Rows 1–9 and 11 were exercised against a live API + Postgres at the end of Phases 2 and 5, including running the clients' real `completion.ts` and `deriveStats.ts` over an actual `GET /habits` payload: a 3-of-8 day reported 37.5% progress, did not complete, and did not extend the streak.

---

## 9. Out of scope (deliberate), for later

- **Partial credit in streak maths** (D5) — revisit only with a real user complaint.
- **Auto-logging duration habits from the focus timer.** A "30 min reading" habit could absorb a finished focus session's minutes automatically. Genuinely good, but it couples two subsystems and deserves its own doc.
- **Decimal amounts** (2.5 km). `Int` covers every template case; `Float` invites rounding bugs in the completion comparison.
- **Per-day target overrides** ("8 cups on weekdays, 4 at weekends").
- **`@repo/core` extraction** (D8) — the next piece of work after this, not part of it.
