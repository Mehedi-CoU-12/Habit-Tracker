# HabitFlow — The Next Four: Deletion, Widget, Streak Insurance, Auto-log

> **Generated:** 2026-09-03 · **Scope:** `apps/api`, `apps/mobile` (primary), `apps/web` (parity where it earns it) · **Status:** implemented in the working tree. API, mobile, and web type/tests pass; the Android widget still needs its customary custom-dev-client/device smoke test.
> **How to use this doc:** §1 is the recon the designs rest on. §2–§5 are the four features, each with its own decisions, phases and verification. §6 is the sequencing argument and §7 is what these four deliberately leave out.

> **Headline:** Three of these are TypeScript in a codebase you already know, and one is a different kind of project. Account deletion is the only item on the critical path to a store listing — everything else is optional next to it. The widget is the only one that requires native code you do not currently write, and its cost is dominated by a problem that has nothing to do with habits: **a widget renders without your JS runtime**, so none of your existing state is reachable from it.

---

## 1. Recon — what the code actually does today

Facts the four designs are built on. Every one of these was read, not assumed.

**Auth and sessions.** `User.tokenVersion` is a real revocation mechanism, not decoration: [jwt.strategy.ts:50](../apps/api/src/auth/jwt.strategy.ts#L50) rejects any access token whose embedded `tokenVersion` differs from the row, and [auth.service.ts:230](../apps/api/src/auth/auth.service.ts#L230) bumps it to sign out of all sessions. Refresh tokens are checked the same way at [auth.service.ts:208](../apps/api/src/auth/auth.service.ts#L208). A deleted user's tokens therefore die on the next request without any extra work — the row is gone, so the lookup fails.

**Local teardown already exists and is thorough.** [AuthProvider.tsx:109](../apps/mobile/src/api/AuthProvider.tsx#L109) `clearLocalSession` removes the access and refresh tokens, calls `resetSync()`, `clearOutbox()`, `queryClient.clear()` and `persister.removeClient()`. Account deletion should reuse it rather than reinvent it.

**But it does not touch notifications.** There is no `cancelAllScheduledNotificationsAsync` anywhere in the sign-out path — `reminders.ts` only cancels individual identifiers during a resync ([reminders.ts:229](../apps/mobile/src/notifications/reminders.ts#L229)). Reminders are **local** `scheduleNotificationAsync` calls, so they are already sitting in the OS scheduler. **A deleted account keeps getting "Did you drink water today?" until the app is reinstalled.** This is the single easiest thing to miss in Feature 1.

**User endpoints are thin.** [users.controller.ts](../apps/api/src/users/users.controller.ts) exposes exactly `GET /users/me`, `PATCH /users/me`, `POST /users/me/avatar`. There is no delete of any kind.

**Cascades are mostly configured.** In [schema.prisma](../apps/api/prisma/schema.prisma): `Habit`, `Payment`, `FocusSession` and `DayNote` all declare `onDelete: Cascade` from `User`. `HabitLog` cascades from `Habit`. So a hard `user.delete()` already removes the entire graph — **including the `Payment` rows an admin recorded**, which is a business decision, not a technical one (D1.3).

**`FocusSession.recordSession` is already idempotent by client id.** [focus.service.ts:44](../apps/api/src/focus/focus.service.ts#L44) — if `dto.id` already exists it returns the existing row and does nothing else. This is the fact that makes Feature 4 tractable, and it is why auto-log belongs on the server (D4.1).

**Streaks are computed in two different places with two different scopes.** [deriveStats.ts:66](../apps/mobile/src/lib/deriveStats.ts#L66) walks back from today but only to `dd >= 1` — it is **month-scoped**, so it cannot see a streak crossing a month boundary. The detail screen instead shows [heatmap.ts:418](../apps/mobile/src/lib/heatmap.ts#L418) `habitHistoryStats`, which walks a multi-month `depth` map. **Feature 3 must change both or they will disagree on screen**, and the second one is the one users actually read on the habit page.

**Rest days already do what a "skip" does.** [deriveStats.ts:67-75](../apps/mobile/src/lib/deriveStats.ts#L67-L75): `if (!dueOn(dd)) continue;` — a non-due day neither extends nor breaks. Mechanically, insurance is "make this due day behave like a rest day, retroactively, at most N times". That is a much smaller change than it sounds, and it is why this feature is decision-bound rather than code-bound.

**Heatmap level 1 is taken.** [heatmap.ts:365](../apps/mobile/src/lib/heatmap.ts#L365) — `level: d > 0 ? depthToLevel(d) : part ? 1 : 0`. Quantifiable habits claimed level 1 for partial days, so a skipped day needs its own visual treatment rather than a spare level.

**The outbox has seven op kinds.** [outbox.ts:57-77](../apps/mobile/src/offline/outbox.ts#L57-L77): `habit.create/update/delete`, `log.set`, `log.amount`, `note.set`, `focus.record`. `sync.ts` dispatches with an `assertNever` guard, so a missing case is a compile error.

**`deriveStats.ts` and `completion.ts` are still duplicated** between `apps/mobile/src/lib/` and `apps/web/src/lib/`. The `@repo/core` extraction ("D8" in [quantifiable-habits-plan.md](quantifiable-habits-plan.md)) is agreed but not done. Feature 3 lands squarely in the duplicated file — see §6.

---

## 2. Feature 1 — In-app account deletion

**Why:** Google Play and the App Store both require it for any app with accounts. You have none. This is the gate on a store listing, and a store listing is the gate on every growth idea in this document.

**Crux:** the deletion itself is a one-liner — Prisma cascades handle the graph. The work is everything _around_ it: proving intent, tearing down local state that outlives the account, and the web URL Google requires _in addition_ to the in-app flow.

### Decisions

**D1.1 — Hard delete, not soft.** `prisma.user.delete()` and let the cascades run. _Rejected:_ a soft-delete flag with a 30-day grace period. It reads as user-friendly but it means every query in the app grows an `AND deletedAt IS NULL`, the unique constraint on `email` blocks re-registration, and you now own a purge job. A hard delete with a clear confirmation is honest and finite. If you later want grace, `AccountStatus.SUSPENDED` already exists as a place to put it.

**D1.2 — Re-authentication required, but only for password accounts.** Ask for the current password before deleting. Google-only users (`googleId` set, `password` null) cannot supply one — for them, require typing the word `DELETE`. _Rejected:_ trusting the access token alone. A borrowed unlocked phone should not be able to erase two years of history in three taps.

**D1.3 — The `Payment` cascade is a decision you must make explicitly.** A hard delete destroys that user's admin-recorded payment rows. For a manual cash ledger in BDT this is probably wrong — you may need those records after the user is gone. **Recommendation:** change `Payment.userId` to `onDelete: SetNull` (making it nullable) and denormalize `email` onto the row before deleting, so the ledger survives as an anonymous-but-attributable record. _Rejected:_ keeping the cascade. It is simpler, and it silently deletes your own revenue history the first time a paying user leaves.

**D1.4 — Cancel every scheduled notification, locally, before the request.** See §1: reminders live in the OS scheduler and survive both sign-out and account deletion today. _Rejected:_ doing it after the API call — the API call can fail offline, and you would rather over-cancel than leave a deleted account nagging someone.

**D1.5 — A public web route, because Play requires one.** Google Play's Data Safety form demands a **web-reachable URL** where a user can request deletion without installing the app. `apps/web` has no such route. _Rejected:_ pointing the form at the in-app flow. It gets the listing rejected.

### Data model

Only if D1.3 is accepted: `Payment.userId String?` + `onDelete: SetNull`, plus `Payment.userEmail String?` captured at record time. Both nullable, so the migration is `ALTER TABLE` only with no backfill.

### API

- `DELETE /users/me` with `DeleteAccountDto { password?: string; confirmation?: string }`. Remember `forbidNonWhitelisted` — both fields must be decorated.
- Verify the password with the same comparator `auth.service` uses, or require `confirmation === "DELETE"` for Google accounts.
- Delete inside a transaction; bump nothing — the row is gone, so `jwt.strategy` fails naturally on the next request.
- Invalidate the user's Redis keys (`cacheKeys.authUser`, the habits version, `focusVersion`) so a cached auth row cannot outlive the account.

### Mobile

- A destructive row at the bottom of the **Your account** section in [settings.tsx](<../apps/mobile/src/app/(tabs)/settings.tsx>), visually separated from **Sign out**.
- Reuse the `HabitSheet` confirmation pattern — you already have a two-step destructive sheet for habit deletion; matching it costs nothing and users have seen it.
- The teardown order matters: **cancel notifications → call the API → `clearLocalSession()`**. Cancelling first means an offline failure leaves the user signed in but un-nagged, which is recoverable; the reverse leaves ghost reminders.

### Web

- `/account/delete` — a logged-in page with the same confirmation, plus a logged-out explainer describing how to request deletion by email. The second half is what satisfies D1.5.

### Phases

**Phase 1 — API**

- [ ] `DeleteAccountDto` + `DELETE /users/me` with password / `DELETE`-word verification
- [ ] Redis invalidation for auth, habits and focus keys
- [ ] Decide D1.3; if yes, the `Payment` migration lands here
- [ ] Jest: password-required, Google-account path, cascade leaves no orphans, deleted user's token is rejected on the next request

**Phase 2 — Mobile**

- [ ] `cancelAllScheduledNotificationsAsync` added to the teardown, and to `clearLocalSession` generally (sign-out has the same leak)
- [ ] Settings row + confirmation sheet + the ordered teardown
- [ ] Verify the outbox is cleared and no queued op survives to 404 forever

**Phase 3 — Web + store**

- [ ] `/account/delete`, logged-in and logged-out halves
- [ ] Link it from the mobile settings screen and from the Play Data Safety form

### Verification

| #   | Scenario                                           | Expected                                                           |
| --- | -------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Delete with the wrong password                     | 401, account intact                                                |
| 2   | Delete a Google-only account                       | Accepted with `DELETE` typed; no password branch reached           |
| 3   | After deletion, replay an old access token         | Rejected — the `jwt.strategy` user lookup finds nothing            |
| 4   | Habits, logs, notes, focus sessions after deletion | All gone; no orphaned `HabitLog`                                   |
| 5   | Scheduled reminders after deletion                 | None fire — **the regression to actually test**                    |
| 6   | Delete while offline                               | Clear failure, still signed in, nothing half-torn-down             |
| 7   | Re-register with the same email                    | Succeeds — no soft-delete row blocking the unique constraint       |
| 8   | A paying user is deleted (D1.3 accepted)           | `Payment` rows survive with a null `userId` and the captured email |

**Effort:** 1–2 days. Dominated by the teardown ordering and the web route, not the delete.
**Risk:** low, with one sharp edge — D1.3 is irreversible once a user is gone.

---

## 3. Feature 2 — Home-screen widget

**Why:** growth. A widget is simultaneously the lowest-friction logging surface and the thing people screenshot and share. It is how HabitKit and Streaks win.

**Crux, stated plainly:** a widget draws **without your JS runtime running**. Your habits live in a react-query cache persisted to AsyncStorage, which is not meaningfully readable from native widget code. So the real feature is not "draw a grid" — it is **maintaining a second, native-readable copy of your state**, updated on every write, forever. Every design decision below follows from that.

### Decisions

**D2.1 — Read-only first. No tap-to-complete in v1.** _Rejected:_ an interactive widget. On Android a click intent would have to reach the completion rules and the outbox with no JS running, which means reimplementing `completion.ts` and the queue natively — the exact "fourteen call sites disagree" problem the quantifiable-habits work just finished eliminating. On iOS it needs AppIntents and iOS 17+. A read-only widget delivers most of the screenshot value at a fraction of the cost and risk. Revisit once the mirror below is proven in production.

**D2.2 — A dedicated native mirror, written on every mutation.** Add a thin `widgetMirror.ts` that writes a small, flat, already-computed payload (habit name, icon, today's progress, the last ~30 days of levels) to Android `SharedPreferences` and an iOS App Group. Call it from the same places that already invalidate — the mutation hooks in `api/hooks.ts` and the sync drain. _Rejected:_ teaching the widget to read AsyncStorage. It is backed by a store whose format is an implementation detail you do not control across Expo upgrades; depending on it is a time bomb.

**D2.3 — The mirror stores presentation, not domain state.** Write `level: 0|1|2|3|4` per day, not raw logs. _Rejected:_ mirroring logs and computing in native code — that is `completion.ts` duplicated into a third language, which is how the two clients drifted in the first place.

**D2.4 — Android first, iOS deferred.** You ship a sideloaded Android APK and have no iOS distribution at all. _Rejected:_ both at once. iOS doubles the native surface for an audience you currently cannot reach.

**D2.5 — Three sizes, one data shape.** Small = one habit's ring; medium = today's list with progress; large = the month heatmap. All three read the same mirror payload, so adding a size is layout work only.

### Data model / API

None. This is entirely a client concern.

### Mobile

- Requires a **prebuild / custom native module**. You already ship `expo-dev-client`, so this does not break your workflow, but it does mean the widget cannot be tested in Expo Go and every widget change needs a dev-client build.
- Evaluate `react-native-android-widget` against a hand-rolled config plugin **before** committing — check its maintenance status and SDK 54 compatibility yourself; do not take a version number on faith.
- Theme parity: read the accent and dark-mode choice from the mirror payload too, or the widget will look wrong for every user who changed either.

### Web

Not applicable. Say so and move on.

### Phases

**Phase 1 — Prove the bridge (do this before designing any pixels)**

- [ ] Spike: write a hardcoded string from JS to `SharedPreferences`, read it from a trivial Android widget, confirm it survives an app cold start and a device reboot
- [ ] If this spike is painful, **stop and re-scope** — everything downstream assumes it is cheap

**Phase 2 — The mirror**

- [ ] `widgetMirror.ts` with a versioned payload shape
- [ ] Write it from every habit mutation and from the post-sync drain
- [ ] Handle the signed-out and empty states explicitly — a stale widget showing a deleted account's habits is a bug report

**Phase 3 — The widget**

- [ ] Medium size first (today's list) — it is the one people keep
- [ ] Small and large
- [ ] Theme + accent parity

### Verification

| #   | Scenario                          | Expected                                                        |
| --- | --------------------------------- | --------------------------------------------------------------- |
| 1   | Complete a habit in-app           | Widget reflects it without opening the app again                |
| 2   | Device reboot, app never launched | Widget still renders last known state                           |
| 3   | Complete a habit offline          | Widget updates immediately from the mirror, not from the server |
| 4   | Sign out                          | Widget shows a signed-out state, not stale habits               |
| 5   | Delete the account                | Same — **this is the one that leaks private data if wrong**     |
| 6   | Change accent / dark mode         | Widget follows                                                  |

**Effort:** 1–3 weeks, and the range is real. Dominated by native setup and the build loop, not by the drawing. **Phase 1 is a go/no-go gate** — run it before promising anyone a date.
**Risk:** high. It is the only item here that can fail for reasons outside your codebase.

---

## 4. Feature 3 — Streak insurance

**Why:** retention. One missed day currently zeroes a 40-day streak, and that is precisely the moment people delete habit trackers.

**Crux:** the code is small — §1 showed a rest day already neither extends nor breaks a streak, so insurance is "retroactively treat one due day as a rest day". The sprawl is entirely in the semantics, and in the fact that **streaks are computed in two places with different scopes**.

### Decisions

**D3.1 — A skip is a recorded row, not a derived allowance.** Store it. _Rejected:_ deriving forgiveness from a rule ("the streak survives one gap per month") with no storage. It needs no migration, but it cannot express _which_ day was forgiven, cannot show the user what they spent, and silently changes the meaning of every historical streak the moment it ships. Storing it means the past stays the past.

**D3.2 — Manually spent, not auto-applied.** The user taps "use a skip" on a missed day. _Rejected:_ auto-healing on the first miss. Auto-healing makes the streak number quietly dishonest — the thing whose honesty is the entire reason people trust it — and users cannot tell why the number did not drop. A deliberate tap keeps the streak meaningful and turns the feature into a small moment of agency.

**D3.3 — A skip preserves the streak but does not count toward the rate.** It bridges the chain; it is not a completion. _Rejected:_ counting it as done. That inflates the completion percentage, and the rate is the number people use to judge themselves honestly.

**D3.4 — It does not extend `best`.** `best` is the high-water mark of actual work. _Rejected:_ symmetry with `streak`. Records should be unforgiving even when daily life is not.

**D3.5 — Allowance is per-habit, per-calendar-month, default one.** Per-habit because habits differ in difficulty; monthly because `deriveHabitStats` is already month-scoped, so the allowance and the maths share a natural boundary. _Rejected:_ per-account. A shared pool means a hard habit's skip is stolen from an easy one, and users have to budget.

**D3.6 — Both streak implementations change together, in the same commit.** `deriveStats.ts` (month-scoped) and `heatmap.ts habitHistoryStats` (multi-month) each need the rule. _Rejected:_ doing the visible one first. They are shown on adjacent screens; a mismatch reads as a bug and is very hard to un-see.

### Data model

```prisma
model HabitSkip {
  id      String @id @default(cuid())
  habitId String
  habit   Habit  @relation(fields: [habitId], references: [id], onDelete: Cascade)
  userId  String
  year    Int
  month   Int
  day     Int
  createdAt DateTime @default(now())

  @@unique([habitId, year, month, day])
  @@index([userId, year, month])
}
```

A new table, so no existing row changes and no backfill. Every historical streak is byte-identical until a user spends their first skip.

### API

- `PUT /habits/skips` (absolute, idempotent — `{ habitId, year, month, day, used: boolean }`) so an outbox replay converges, exactly like `PUT /habits/logs`.
- Enforce the monthly allowance **server-side**; a client-only check is a suggestion.
- `GET /habits` must return the month's skips alongside logs, or the clients cannot compute anything.

### Mobile

- New outbox op `skip.set`, coalescing per `(habit, date)` like `log.set`. Add the `sync.ts` case — `assertNever` will catch the omission at compile time.
- `completion.ts` gains `isDaySkipped(h, day)`; the streak loops consult it. Keep it out of `isDayComplete` — a skipped day is _not_ complete, and conflating them corrupts the rate.
- Calendar day-detail gets a "use a skip" action on a missed day, showing the remaining allowance.
- Heatmap needs a distinct treatment (level 1 is taken by partial days — use a hollow or hatched cell rather than a new level).
- `Plant.tsx` stages on streak, so a skip keeps the plant alive. That is the emotional payoff and it comes for free.

### Web

Full parity — this changes the streak number, and web shows it. This is the feature most exposed to the `deriveStats` duplication; see §6.

### Phases

**Phase 1 — Model + API:** [ ] `HabitSkip`, migration, `PUT /habits/skips`, allowance enforcement, skips in `GET /habits`, Jest for allowance + replay idempotency
**Phase 2 — Shared maths:** [ ] `isDaySkipped`, both streak loops (`deriveStats` + `habitHistoryStats`), tests asserting a skip bridges the streak, does not extend `best`, does not raise the rate
**Phase 3 — Mobile UI:** [ ] outbox op, calendar action, heatmap treatment, allowance display
**Phase 4 — Web parity:** [ ] mirror the maths and the grid cell

### Verification

| #   | Scenario                                   | Expected                                                   |
| --- | ------------------------------------------ | ---------------------------------------------------------- |
| 1   | A habit with no skips, after the migration | Identical streak/best/rate to before                       |
| 2   | Miss a day, spend a skip                   | Streak spans the gap                                       |
| 3   | …check the rate                            | Unchanged by the skip — it is not a completion             |
| 4   | …check `best`                              | Not extended                                               |
| 5   | Spend a second skip in one month           | Refused server-side, not just hidden in the UI             |
| 6   | Spend a skip in the next month             | Allowed — allowance resets                                 |
| 7   | A skip on a rest day                       | No-op or refused; it cannot be spent where nothing was due |
| 8   | Replay `PUT /habits/skips` three times     | One row                                                    |
| 9   | The habit detail screen vs the Today row   | Same streak — **the D3.6 regression**                      |
| 10  | Web and mobile, same account               | Identical streak/best/rate                                 |

**Effort:** 3–5 days. Dominated by deciding §D3.1–D3.5 and by touching both streak implementations, not by the code.
**Risk:** medium. It changes a number users have an emotional relationship with.

---

## 5. Feature 4 — Auto-log duration habits from the focus timer

**Why:** it is the most distinctive feature available to you, because it needs both halves — a focus timer bound to a habit, and quantified habits — and you are one of very few habit trackers that has both. Deferred deliberately in [quantifiable-habits-plan.md](quantifiable-habits-plan.md) §9; this is the follow-up.

**Crux:** `PUT /habits/logs/amount` is **absolute**, by design, so that outbox replays converge. But "a 25-minute session adds 25 minutes" is **relative**. Naively composing them double-counts on every replay. §1 found the way out: `recordSession` is already idempotent by client-generated id, so the increment belongs _inside_ it.

### Decisions

**D4.1 — Auto-log server-side, inside `recordSession`.** [focus.service.ts:44](../apps/api/src/focus/focus.service.ts#L44) already returns early when `dto.id` exists. Putting the `HabitLog` increment after that guard means a replayed session increments **exactly once**, for free, with no new idempotency machinery. _Rejected:_ the client calling `setLogAmount` after a session. It has to read the current amount, add, and write back — a lost-update race between two devices, and a double-count on any replay. This decision is the whole feature.

**D4.2 — Opt-in per habit, via an explicit flag.** Add `Habit.fillFromFocus Boolean @default(false)`. _Rejected:_ string-matching `unit` against `"min"`/`"mins"`/`"minutes"`. `unit` is free text (max 16 chars) and user-entered; inferring intent from it means a habit called "20 minutes of guitar" silently starts filling itself, and a typo silently stops it. An explicit checkbox in the add/edit form is one line of UI and never guesses wrong.

**D4.3 — Clamp at the target; never exceed.** A 50-minute session against a 30-minute target logs 30. _Rejected:_ letting it overflow. The rate calculation already guards against exceeding 100%, but an amount of 50/30 renders as a broken progress bar in three places.

**D4.4 — Only sessions bound to a habit auto-log.** `FocusSession.habitId` is nullable and a general focus session belongs to no habit. Unbound sessions change nothing.

**D4.5 — Do not retro-fill history.** Only sessions recorded after the feature ships count. _Rejected:_ backfilling past sessions into past logs. It would rewrite completed days, which rewrites streaks, which rewrites the one number users trust.

### Data model

`Habit.fillFromFocus Boolean @default(false)` — defaulted, so `ADD COLUMN` only, no backfill, and every existing habit is opted out.

### API

- `recordSession` gains a step after the idempotency guard: if `habitId` is set and the habit has `fillFromFocus` and a non-null `target`, upsert its `HabitLog` for that day to `min(target, existing.amount + session.minutes)`.
- Do it in the **same transaction** as the session create, so a crash cannot leave a session recorded without its minutes.
- Call `invalidateHabits(userId)` as well as the existing `bumpVersion(focusVersion)` — the habits cache is now stale too, and forgetting this is the bug where the ring does not move until you pull to refresh.
- `create-habit.dto.ts` / `update-habit.dto.ts` gain `fillFromFocus?: boolean` with `@IsOptional() @IsBoolean()`. Remember `forbidNonWhitelisted`.

### Mobile

- The existing "completing a session waters the habit" behaviour in [focus.tsx](../apps/mobile/src/app/focus.tsx) becomes conditional: for a `fillFromFocus` habit the server does the work, so the client should **stop** calling toggle and let the refetch land. Leaving both in is a double-write.
- `add.tsx` — one checkbox inside the existing "Track a number" block, visible only when a target is set.
- The `focus.record` outbox op needs no change, which is the point of D4.1.

### Web

Parity: the same checkbox in `HabitModal`, and the same removal of the client-side water in `app/focus/page.tsx`.

### Phases

**Phase 1 — API:** [ ] `fillFromFocus` column + DTOs; the transactional increment inside `recordSession`; `invalidateHabits`; Jest for replay-once, clamping, opted-out habits, unbound sessions
**Phase 2 — Mobile:** [ ] the add/edit checkbox; make the focus screen's water conditional
**Phase 3 — Web parity:** [ ] modal checkbox; conditional water

### Verification

| #   | Scenario                                           | Expected                                                  |
| --- | -------------------------------------------------- | --------------------------------------------------------- |
| 1   | 25-min session, 30-min target, `fillFromFocus` on  | Amount 25, day not complete                               |
| 2   | A second 10-min session the same day               | Amount 30, complete — **clamped, not 35**                 |
| 3   | Replay the same session id three times             | Amount unchanged after the first — **the D4.1 guarantee** |
| 4   | Session recorded offline, replayed on reconnect    | Counted once                                              |
| 5   | Habit with `fillFromFocus` off                     | Unchanged; old watering behaviour intact                  |
| 6   | Session with no habit bound                        | No log written anywhere                                   |
| 7   | Binary habit (no target) with the flag somehow set | No-op — guard on `target != null`                         |
| 8   | Mobile and web after the same session              | Same amount; no double-write from the client              |

**Effort:** 2–4 days. Dominated by getting the transaction and cache invalidation right, and by removing the old client-side water without breaking binary habits.
**Risk:** medium. It writes to `HabitLog` from a second code path for the first time.

---

## 6. Sequencing

**Build order: Deletion → Auto-log → Streak insurance → Widget.**

**Deletion first**, unconditionally. It is the only item on the critical path to a store listing, it is the smallest, and it is the only one whose absence blocks the others from mattering. A widget is worth very little if the app cannot be listed.

**Auto-log second**, because it is self-contained. It adds one defaulted column and one guarded branch inside an already-idempotent function. It touches no shared maths and cannot regress a streak.

**Streak insurance third, and only after the `@repo/core` extraction** — or with eyes open. It changes `deriveStats.ts`, the single most-duplicated file in the repo, in **both** clients, in a file that has already drifted once. Doing the extraction first turns a two-copy change into a one-copy change and is the cheapest it will ever be. If you skip the extraction, at minimum land Phase 2 (the shared maths) in one commit across both apps so the drift cannot open.

**Widget last**, and gated on its Phase 1 spike. It shares no code with the other three, so its position is free — put it where a multi-week native detour hurts least, which is after the things that unblock distribution and retention.

**One collision worth naming:** the widget mirror (D2.2) must be written after _any_ state change, and streak insurance introduces a new one (`skip.set`). Build the widget last and the mirror is written once against a settled set of mutations; build it earlier and you will retrofit it.

---

## 7. Out of scope (deliberate)

- **An interactive, tap-to-complete widget** (D2.1) — revisit only once the read-only mirror is proven in production.
- **iOS widget** (D2.4) — no iOS distribution exists to justify it yet.
- **Soft delete with a grace period** (D1.1) — `AccountStatus.SUSPENDED` is where that would go if it is ever wanted.
- **Auto-applied streak forgiveness** (D3.2) — a deliberate tap is the feature, not a limitation.
- **Retro-filling past focus sessions into past logs** (D4.5).
- **Rolling or purchasable skip allowances** — monetising forgiveness is a product decision, not an implementation one.
- **Self-serve billing.** The `Payment` model is admin-recorded cash in BDT. Nothing here changes that, and nothing here should — but note that "attract people at scale" and "an admin records your cash payment" cannot both be true, and that tension outranks three of these four features.
