# HabitFlow Mobile — What To Build Next

> **Generated:** 2026-09-04 · **Scope:** `apps/mobile` (primary), `apps/api` + `apps/web` where parity earns it · **Status:** proposal — nothing here is implemented.
> **How to use this doc:** §1 is what the app actually does today, so the gaps below are honest rather than remembered. §2 is the full ranked gap list. §3–§8 are the six features worth building now, each with its own decisions, phases and verification. §9 is the next tier, designed only as far as the decision that blocks it. §10 sequences the work and §11 says what this deliberately leaves out.

> **Headline:** the hard parts are done. Offline sync, quantities, streak insurance, local reminders, an Android widget, account deletion and a focus timer are all real. What is missing now is **not more machinery — it is the first ninety seconds, the reward moment, and the two things a user cannot do at all: recover a forgotten password, and get their data out.** Five of the six features below are pure client wiring against endpoints that already exist. One of them (password reset) is the only item that needs new infrastructure, and it is the only item where a real user is currently _stuck with no way forward_.

---

## 1. Where the app actually is today

Read, not assumed. Everything in §2 onwards rests on these.

**The old roadmap is mostly done.** [mobile-audit-and-roadmap.md](mobile-audit-and-roadmap.md) listed twelve high-priority gaps; ten are shipped. Account deletion ([DeleteAccountSheet.tsx](../apps/mobile/src/components/DeleteAccountSheet.tsx), `DELETE /users/me` at [users.controller.ts:41](../apps/api/src/users/users.controller.ts#L41)), local reminders ([notifications/](../apps/mobile/src/notifications/)), real multi-month heatmaps ([heatmap.ts](../apps/mobile/src/lib/heatmap.ts)), cross-month streaks, a working Stats period switcher, calendar backfill with per-day notes, offline persistence, Google sign-in, silent token refresh ([client.ts:110](../apps/mobile/src/api/client.ts#L110)), rate limiting, and FK indexes ([schema.prisma:123](../apps/api/prisma/schema.prisma#L123)) are all in the tree. The roadmap's "fake features" section no longer describes this app.

**The four features after that also landed.** Per [next-four-features-plan.md](next-four-features-plan.md): account deletion, the Android home-screen widget, streak insurance (`HabitSkip`) and focus-timer auto-log (`Habit.fillFromFocus`) are implemented.

**Sixteen thousand lines of mobile, four test files.** [completion.test.ts](../apps/mobile/src/lib/completion.test.ts), [deriveStats.test.ts](../apps/mobile/src/lib/deriveStats.test.ts), [heatmap.test.ts](../apps/mobile/src/lib/heatmap.test.ts), [schedule.test.ts](../apps/mobile/src/lib/schedule.test.ts) — the pure maths is covered. The outbox, the sync worker and the reminder reconcile pass have no tests, and they are the three places where a bug loses user data silently rather than loudly.

**Mobile is outside CI entirely.** [pnpm-workspace.yaml](../pnpm-workspace.yaml) excludes `apps/mobile` on purpose (Metro/pnpm symlink issues), and [ci.yml](../.github/workflows/ci.yml) runs `pnpm lint` / `check-types` / `build` across the workspace — which therefore skips mobile. Nothing enforces lint, types or `npm test` on the largest app in the repo.

**Onboarding is still decorative.** [onboarding.tsx:65](../apps/mobile/src/app/onboarding.tsx#L65) is `const done = () => router.replace("/")`. The eight seeds the user picks are dropped on the floor, `KEYS.onboarded` ([storage.ts:69](../apps/mobile/src/lib/storage.ts#L69)) is defined but never written or read, and `applyTemplate` is dead client code in both apps ([endpoints.ts:217](../apps/mobile/src/api/endpoints.ts#L217), [web api.ts:330](../apps/web/src/lib/api.ts#L330)). A new user signs up ([signup.tsx:57](../apps/mobile/src/app/signup.tsx#L57)), picks four habits, taps through, and lands on **"Your garden is empty."**

**Profile editing exists on the server and on web, and not on mobile.** `PATCH /users/me` ([users.controller.ts:30](../apps/api/src/users/users.controller.ts#L30)) already takes `name`, `currentPassword` and `newPassword`, validates the current password, bcrypts the new one and bumps `tokenVersion` to revoke every other session ([users.service.ts:70](../apps/api/src/users/users.service.ts#L70)). `apps/web/app/profile` uses it. Mobile's [endpoints.ts](../apps/mobile/src/api/endpoints.ts) has no `updateMe` at all — Settings can change an avatar and nothing else.

**There is no password reset anywhere in the product.** No route in [auth.controller.ts](../apps/api/src/auth/auth.controller.ts), no page in `apps/web/app`, no link on [login.tsx](../apps/mobile/src/app/login.tsx). There is also no mail infrastructure in the API — no nodemailer, no Resend, no SMTP config. **A user who forgets their password is permanently locked out of their account, on every platform.**

**The reward moment does not move.** [Plant.tsx](../apps/mobile/src/components/Plant.tsx) is a static SVG that swaps between five stages at streak 0/3/10/25 with an opacity dim and a 3° tilt when not done. `expo-haptics` is not installed and there is not one haptic call in the app. The only celebration is a 700 ms sparkle on the detail screen ([habit/\[id\].tsx:115](../apps/mobile/src/app/habit/[id].tsx#L115)). `react-native-reanimated@~4.1.1` and `react-native-worklets@0.5.1` are in `package.json` and imported **nowhere** in `src/`; the codebase's actual animation idiom is RN's own `Animated` ([primitives.tsx](../apps/mobile/src/components/primitives.tsx), [HabitSheet.tsx](../apps/mobile/src/components/HabitSheet.tsx), [DeleteAccountSheet.tsx](../apps/mobile/src/components/DeleteAccountSheet.tsx)).

**Data goes in and never comes out.** No export of any kind. `expo-file-system` and `expo-sharing` are not installed, `Share` is never called. Deletion shipped (GDPR erasure); portability did not.

**Reminders are local-only.** [reminders.ts:281](../apps/mobile/src/notifications/reminders.ts#L281) schedules with `scheduleNotificationAsync` over a rolling 5-day horizon ([types.ts](../apps/mobile/src/notifications/types.ts) `HORIZON_DAYS`), topped up on every foreground. There is no push token, no server-sent notification, and therefore **no way to reach a user who has stopped opening the app** — which is exactly the user a habit tracker needs to reach.

**The widget is Android-only and view-only.** [expo-module.config.json](../apps/mobile/modules/habitflow-widget/expo-module.config.json) declares `"platforms": ["android"]`, and the only `PendingIntent` in [Providers.kt:89](../apps/mobile/modules/habitflow-widget/android/src/main/java/com/habitflow/widget/Providers.kt#L89) is `launchApp`. Tapping a habit on the home screen opens the app; it cannot water anything.

**iOS is not shippable.** [app.json](../apps/mobile/app.json) `ios` contains only `supportsTablet` — no `bundleIdentifier`. [eas.json](../apps/mobile/eas.json) has Android blocks in all three build profiles and no `ios` key anywhere. There is no iOS build today, so half of [types.ts](../apps/mobile/src/notifications/types.ts)'s careful `IOS_BUDGET` reasoning is currently untested in practice.

**Accessibility is 5% done.** `accessibilityLabel` appears in exactly two files ([archived.tsx](../apps/mobile/src/app/archived.tsx), [habit/\[id\].tsx](../apps/mobile/src/app/habit/[id].tsx)) out of ~30. The tab bar's icon buttons are 40×40 with no `hitSlop` ([(tabs)/\_layout.tsx](<../apps/mobile/src/app/(tabs)/_layout.tsx>)), and the completion toggle every user presses all day is 38 px wide ([HabitRow.tsx:154](../apps/mobile/src/components/HabitRow.tsx#L154)) — both under the 44 pt floor.

**Other absences, confirmed:** no habit ordering (`Habit` has no `order` column, so Today's list order is whatever Postgres returns), no tags or folders, no habit search, no crash reporting (`Sentry` appears nowhere in any app), no i18n, no biometric app lock, and pull-to-refresh exists on exactly one screen ([pending.tsx:28](../apps/mobile/src/app/pending.tsx#L28)).

---

## 2. The gap list, ranked

Tier A is "a user is stuck or the product lies to them". Tier B is "the loop works but doesn't reward". Tier C is reach and platform. Tier D is tracked elsewhere.

| #   | Gap                                                | Tier | Area               | Effort | Why it matters                                                                                                                             |
| --- | -------------------------------------------------- | ---- | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Password reset**                                 | A    | api · web · mobile | M      | A forgotten password is a permanently lost account. No workaround exists.                                                                  |
| 2   | **Onboarding discards the habits it asked for**    | A    | mobile             | S      | Every new user's first screen is "Your garden is empty". ~40 lines of wiring.                                                              |
| 3   | **No profile / password editing on mobile**        | A    | mobile             | S      | Endpoint + web reference already exist; mobile just never called it.                                                                       |
| 4   | **No haptics, no growth animation, no milestones** | B    | mobile             | S–M    | "Watch it grow" is the product thesis and the plant is a static image.                                                                     |
| 5   | **No data export**                                 | B    | mobile · api       | M      | Deletion shipped without portability. Trust, and the GDPR twin of erasure.                                                                 |
| 6   | **Mobile outside CI · no crash reporting**         | B    | ci · mobile        | S      | 16k lines with no enforced checks and zero production error visibility.                                                                    |
| 7   | Widget cannot complete a habit                     | C    | mobile (Kotlin)    | M      | The widget's whole point is one tap without opening the app.                                                                               |
| 8   | iOS not buildable                                  | C    | mobile             | M–L    | Half the addressable market; widget would need a WidgetKit rewrite.                                                                        |
| 9   | No push / re-engagement                            | C    | api · mobile       | L      | Local reminders can't reach a lapsed user. Needs a scheduler + tokens.                                                                     |
| 10  | No habit reorder                                   | C    | api · mobile · web | S–M    | Cheapest remaining "this feels unfinished" complaint. One migration.                                                                       |
| 11  | Accessibility + tap targets                        | C    | mobile             | M      | Icon-only controls are invisible to TalkBack/VoiceOver; 38 px toggle.                                                                      |
| 12  | No share card                                      | C    | mobile             | S      | The only organic growth loop a solo habit app gets.                                                                                        |
| 13  | To-do list · stopwatch                             | D    | web · mobile       | M      | Already tracked in [features-or-bugDoc.md](features-or-bugDoc.md) — not re-planned here.                                                   |
| 14  | `@repo/core` extraction                            | D    | monorepo           | M      | Agreed in [quantifiable-habits-plan.md](quantifiable-habits-plan.md) (D8), still open; `completion.ts`/`deriveStats.ts` remain duplicated. |

**§3–§8 design gaps 1–6. §9 covers 7–12 to the decision point.**

---

## 3. Feature 1 — Password reset

**Why:** it is the only gap in this document where the user has no path forward at all. Everything else is friction; this is a locked door. It also unblocks a "Forgot password?" link that every login screen is expected to have — its absence reads as unfinished.

**Crux:** the token dance is twenty lines. The cost is that **the API has no way to send an email**, and that is a new dependency, a new secret, and a new failure mode in a codebase that currently has none of those.

### Decisions

**D1.1 — A dedicated `PasswordResetToken` row, not a JWT.** Store a SHA-256 hash of a random 32-byte token with a 30-minute expiry and a `usedAt` stamp. _Rejected:_ signing a short-lived JWT. It cannot be invalidated after use, so a leaked mailbox replays the same link until it expires, and you lose the audit trail of whether a reset was actually consumed.

**D1.2 — The request endpoint always answers 200.** Never reveal whether an email is registered. _Rejected:_ a helpful 404. It turns the endpoint into an account-enumeration oracle.

**D1.3 — Consuming a reset bumps `tokenVersion`.** The mechanism already exists ([auth.service.ts:230](../apps/api/src/auth/auth.service.ts#L230)) and `updateProfile` already does this on a password change. A reset is the case where it matters most: the likeliest reason for a reset is that someone else has the password.

**D1.4 — Email links to the web app; the web page offers to open the app.** `apps/web/app/reset-password?token=…`, with a button that deep-links to `habitflow://reset-password?token=…` (the scheme is already registered in [app.json](../apps/mobile/app.json)). _Rejected:_ an app-only link. Reset emails are read on desktops, and a link that dead-ends there is worse than no link.

**D1.5 — Google-only accounts get an explanatory email, not a token.** `password` is null for them ([schema.prisma:47](../apps/api/prisma/schema.prisma#L47)); the correct answer is "you sign in with Google", sent by mail so D1.2 still holds. _Rejected:_ sending nothing. The user retries the form forever and concludes the app is broken.

**D1.6 — One `MailService` behind an interface, with a console transport in dev.** A single `sendMail(to, template, vars)` seam, an HTTP provider (Resend or Postmark — one API key, no SMTP ports to negotiate with Render) in production, and a dev transport that logs the link to stdout. _Rejected:_ wiring the provider SDK directly into `AuthService`. It makes the flow untestable without a live key and unbuildable for anyone cloning the repo.

**D1.7 — Throttle hard, by email and by IP.** `@Throttle` is already available ([app.module.ts:25](../apps/api/src/app.module.ts#L25)) and `/auth/*` already uses it. Reset request: 3 per 15 minutes. _Rejected:_ the default 120/min. That is a mailbox-flooding tool.

### Data model

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId])
}
```

Additive, cascades from `User` like every other child table, so account deletion already handles it.

### API

- `POST /auth/forgot-password` — `{ email }` → always `{ sent: true }`. Invalidates the user's outstanding tokens, creates one, mails it (or mails the Google notice per D1.5).
- `POST /auth/reset-password` — `{ token, password }` → `{ success: true }`. Rejects expired/used/unknown tokens with one generic message, bcrypts the new password, stamps `usedAt`, bumps `tokenVersion`, drops the cached auth row (the same invalidation `updateProfile` does at [users.service.ts:112](../apps/api/src/users/users.service.ts#L112)).

### Web

`app/reset-password/page.tsx` — reads `?token`, new-password + confirm fields, an "Open in HabitFlow" deep link, and a success state that routes to `/login`. Plus a "Forgot password?" link on `/login`.

### Mobile

`app/forgot-password.tsx` (email → "check your inbox" state) and `app/reset-password.tsx` (handles the `habitflow://reset-password` deep link; `expo-linking` is already a dependency). A "Forgot password?" link under the password field on [login.tsx](../apps/mobile/src/app/login.tsx). On success, sign in with the new password rather than dropping the user back on a blank form.

### Phases

1. `MailService` + console transport + one template renderer. No routes yet.
2. Migration + `PasswordResetToken` and the two endpoints, tested against the console transport.
3. Web page + login link.
4. Mobile screens + deep link + login link.
5. Provider key in Render env, verified end-to-end with a real address.

### Verification

- Requesting a reset for an unknown email returns 200 in the same shape and timing as a known one.
- A used token is refused; so is a 31-minute-old one; so is a token after a second request superseded it.
- Consuming a reset signs out a second logged-in device on its next request (that is `tokenVersion` doing its job).
- A Google-only account receives the explanatory mail and no token row is created.
- Four requests in 15 minutes: the fourth is throttled.
- With no provider key configured, the API boots and logs the link instead of crashing.

---

## 4. Feature 2 — Onboarding that actually plants

**Why:** the highest-leverage change in this document per line of code. First-session habit creation is the strongest day-1 retention predictor in every study of this category, and right now the app _asks_ for the picks and then throws them away — which is worse than not asking, because it makes the empty garden feel like a bug.

**Crux:** there is no hard problem here. The work is (a) giving the eight seeds real habit fields, (b) calling the mutation that already exists, (c) writing the flag that already has a key, and (d) not duplicating habits when Settings replays the flow.

### Decisions

**D2.1 — Create through `useCreateHabit`, not the server's `applyTemplate`.** The hook already mints a client id, enqueues `habit.create` on the outbox and writes the optimistic row into every `["habits", …]` cache ([hooks.ts](../apps/mobile/src/api/hooks.ts)) — so the garden is populated the instant the flow closes, works offline, and converges on replay. _Rejected:_ `POST /habits/apply-template`. It needs a round trip before the garden looks right, its template ids don't correspond to the `SEEDS` list, and it is dead code in both clients — this feature should **delete** it rather than adopt it.

**D2.2 — Seeds carry real fields, not just an icon and a name.** [onboarding.tsx:12](../apps/mobile/src/app/onboarding.tsx#L12) is `{ i, n }` pairs. Extend each to `{ name, icon, tod, goal, target?, unit?, step? }` so "Drink water" arrives as 8 cups quantified, "Sleep by 11" arrives as an `evening` habit, and "Move body" arrives with a sane monthly goal. _Rejected:_ creating them bare and letting the user fix them. A first habit that is wrong in three fields is a first habit the user deletes.

**D2.3 — Write `KEYS.onboarded`, and gate on it in `AuthGate`.** Today only [signup.tsx:57](../apps/mobile/src/app/signup.tsx#L57) routes into the flow, so a user who kills the app mid-onboarding never sees it again. Read the flag in [\_layout.tsx](../apps/mobile/src/app/_layout.tsx)'s `AuthGate`: authenticated + `ACTIVE` + not onboarded → `/onboarding`. _Rejected:_ inferring it from "has zero habits". A user who deliberately deletes every habit would be re-onboarded forever.

**D2.4 — Ask for notification permission at the end of onboarding.** Reminders default to `enabled: false` ([types.ts](../apps/mobile/src/notifications/types.ts) `DEFAULT_PREFS`), and the moment right after someone has chosen four habits is the moment they will say yes. One toggle, one screen; only call the OS prompt if it is on. _Rejected:_ prompting on app launch (the classic mistake — asked before the value is understood, denied forever) and leaving it buried in Settings (nobody opens Settings).

**D2.5 — Replaying from Settings must not duplicate.** [settings.tsx:639](<../apps/mobile/src/app/(tabs)/settings.tsx#L639>) pushes `/onboarding` for accounts that already have habits. When the garden is non-empty, pre-deselect every seed whose name already exists and label the step "add more". _Rejected:_ hiding the replay entry. It is the app's only tour, and re-reading it should be safe.

**D2.6 — Failure is visible.** The mutation writes to the outbox and can only fail on a storage error, but the flow must not claim success it didn't get: disable the button while the writes are in flight and keep the user on the step if one throws.

### Data model / API

None. Every field already exists.

### Mobile

- `SEEDS` becomes a typed template list (D2.2).
- `done()` maps picked seeds → `useCreateHabit` calls, writes `KEYS.onboarded`, optionally enables reminders (D2.4), then `router.replace("/")`.
- `AuthGate` reads the flag (D2.3); a small `useOnboarded()` hook over `storage`, resolved before the gate's first routing decision so it doesn't flash the garden first.
- Seed pre-deselection when habits exist (D2.5).
- Delete `applyTemplate` from [endpoints.ts:217](../apps/mobile/src/api/endpoints.ts#L217) and [web api.ts:330](../apps/web/src/lib/api.ts#L330) (D2.1).

### Phases

1. Typed `SEEDS` with real fields.
2. `done()` creates the habits + writes the flag.
3. `AuthGate` gating + the resolved-flag loading state.
4. Reminder opt-in step.
5. Replay de-duplication; delete the dead `applyTemplate` on both clients.

### Verification

- Fresh signup → pick four → finish → Today shows four habits **immediately**, and the routine sections group them by the `tod` each seed declared.
- Kill the app on step 2, reopen → back in onboarding, not in an empty garden.
- Finish onboarding in airplane mode → four habits visible, four ops in the outbox, all four land on reconnect with the same ids.
- Settings → Replay onboarding on a populated account → finishing adds nothing already present.
- Accepting the reminder step schedules notifications for the new habits (visible in the reminder reconcile); declining schedules none and leaves the master switch off.

---

## 5. Feature 3 — Account & security on mobile

**Why:** the server does the whole job already and mobile is the only client that never calls it. A user who signs up on the phone cannot change their name, and — more seriously — cannot change their password after a scare. It is a few hundred lines against an endpoint with a working web reference.

**Crux:** none technically. The only real decision is what to do about email changes, and the answer is "not yet".

### Decisions

**D3.1 — Name and password now; email read-only.** `PATCH /users/me` accepts `name`, `currentPassword`, `newPassword` ([UpdateProfileDto](../apps/api/src/users/dto/)). Changing an email safely needs a verification round trip that does not exist — show it as read-only rather than shipping an unverified mutable login identity. _Rejected:_ allowing an unverified email change. It hands an attacker with a borrowed session a way to take the account, and it breaks password reset (Feature 1) for the real owner.

**D3.2 — Google-only accounts see no password section.** `hasPassword` is already on the profile ([types.ts](../apps/mobile/src/lib/types.ts)) precisely because [DeleteAccountSheet](../apps/mobile/src/components/DeleteAccountSheet.tsx) needed it. Reuse it. Offer "set a password" only if the API grows a first-password path — today `updateProfile` refuses ([users.service.ts:80](../apps/api/src/users/users.service.ts#L80)), so do not show a control that cannot succeed.

**D3.3 — A password change signs this device out, and the screen must say so first.** `updateProfile` bumps `tokenVersion`, which kills the refresh token this device holds. Warn before submitting, then run `clearLocalSession()` ([AuthProvider.tsx:115](../apps/mobile/src/api/AuthProvider.tsx#L115)) and route to login with the email pre-filled. _Rejected:_ letting the user discover it as a mystery logout. Same reasoning that made account deletion cancel notifications first.

**D3.4 — Online-only, and honest about it.** This is the one mutation that must not go through the outbox: replaying "set password to X" against a server that already accepted it would fail the `currentPassword` check and look like corruption. Disable the section while offline. _Rejected:_ an outbox op for parity. Absolute-and-idempotent is what makes the other ops replayable, and a password change is neither.

### Data model / API

None. `PATCH /users/me` is enough.

### Mobile

- `app/account.tsx` — profile card, name field with a save affordance, a password block (current / new / confirm) behind D3.2, and the existing avatar picker moved here from Settings.
- `updateMe()` in [endpoints.ts](../apps/mobile/src/api/endpoints.ts) + a `useUpdateMe()` mutation that sets `["me"]` on success.
- Settings' profile card becomes a row that opens it; "Delete account" stays in the danger zone where it is.

### Phases

1. `updateMe` endpoint fn + hook.
2. Screen with name editing; move the avatar picker in.
3. Password block, the D3.3 warning, teardown + re-login.
4. Offline gating and error surfaces (wrong current password → inline on the field, not a toast).

### Verification

- Rename → the header on Today and the widget mirror both show the new name (the mirror subscribes to the query cache, so this should follow for free — confirm it does).
- Wrong current password → inline field error, nothing changes server-side.
- Correct change → this device lands on login, the new password works, **and a second device is signed out on its next request**.
- Google-only account → no password section, avatar and name still editable.
- Offline → the password block is visibly disabled with a reason, not silently broken.

---

## 6. Feature 4 — Make the reward moment land

**Why:** the entire pitch is "watch it grow from a seed to a flower". Completing a habit today changes an opacity from 0.5 to 1 and untilts a static SVG by three degrees. There is no sound, no vibration, no motion, and nothing at all happens on the seventh or thirtieth consecutive day. This is the cheapest available increase in perceived quality, and it is the mechanism the product is named after.

**Crux:** deciding how much of it is animation and how much is _acknowledgement_. Motion is the small half. The bigger half is that a 30-day streak — the thing the user actually worked for — currently passes in silence.

### Decisions

**D4.1 — Haptics on three events only.** `expo-haptics`: a light impact on each partial step of a quantified habit, a success notification on the tap that _reaches_ the target or completes a binary habit, and a selection tick on un-completing. Nothing on scroll, navigation or toggles. _Rejected:_ haptics on every press. It stops meaning anything within a day, and it is a battery and accessibility annoyance.

**D4.2 — Animate with RN `Animated`, and drop reanimated.** Every existing animation in the app uses `Animated` ([primitives.tsx](../apps/mobile/src/components/primitives.tsx), [HabitSheet.tsx](../apps/mobile/src/components/HabitSheet.tsx), [DeleteAccountSheet.tsx](../apps/mobile/src/components/DeleteAccountSheet.tsx)); `react-native-reanimated` and `react-native-worklets` are installed and imported nowhere. A stage transition and a wilt spring need a scale, an opacity and a rotation — `Animated` does all three natively. _Rejected:_ adopting reanimated for this. There is no `babel.config.js` in `apps/mobile`, so the worklets plugin is relying on whatever `@expo/metro-config` defaults to; betting the signature animation on an unverified native transform to save nothing is the wrong trade. Removing both packages is part of this feature.

**D4.3 — Milestones are derived from the streak and celebrated once, locally.** When a habit's streak crosses 3 / 10 / 25 / 50 / 100, show a full-screen moment (the plant at its new stage, the number, one line of copy, a "share" affordance if Feature §9.6 lands). Persist only "highest milestone already celebrated" per habit id in `storage`. _Rejected:_ an `Achievement` table. The streak is already the source of truth and is already computed in two places ([deriveStats.ts](../apps/mobile/src/lib/deriveStats.ts), [heatmap.ts](../apps/mobile/src/lib/heatmap.ts)) — a third persisted copy would be a third thing to keep in sync, and it would need a migration to say something the client can derive.

**D4.4 — Milestone thresholds are the plant's stage thresholds.** [Plant.tsx](../apps/mobile/src/components/Plant.tsx) changes stage at 3 / 10 / 25. Celebrating at 7 and 30 would fire on days the plant looks identical, which reads as arbitrary. Export one `STAGES` list and drive both from it — extending it past 25 for the long-streak celebrations. _Rejected:_ the conventional 7/30/100. Consistency with what the user can see beats convention.

**D4.5 — Respect the OS reduce-motion setting.** `AccessibilityInfo.isReduceMotionEnabled()` → cross-fade instead of scale/spring, and skip the full-screen moment's motion while keeping its content. _Rejected:_ ignoring it. Growth animation on every completion is exactly the class of motion that makes some users nauseous.

**D4.6 — No new sounds.** [sound/](../apps/mobile/src/sound/) already exists for focus sessions with five styles and a volume picker. A completion chime would need its own preference, its own quiet-hours interaction, and would fight the focus tones. Haptics carry it. _Rejected:_ a completion sound (for now — if it comes, it belongs in the existing sound system, not beside it).

### Data model / API

None. Milestones are derived; the celebration ledger is local.

### Mobile

- `expo-haptics` added; three call sites (D4.1) in [HabitRow.tsx](../apps/mobile/src/components/HabitRow.tsx), [habit/\[id\].tsx](../apps/mobile/src/app/habit/[id].tsx) and the calendar's day rows.
- `Plant.tsx` grows an `Animated` layer: stage change → scale-in spring on the new tier, `doneToday` → tilt/opacity transition instead of a hard swap.
- `STAGES` exported from `Plant.tsx` (D4.4); `components/Milestone.tsx` full-screen moment; `lib/milestones.ts` for the crossed-threshold check and the local ledger.
- Reanimated + worklets removed from `package.json`.

### Phases

1. Haptics (three call sites). Shippable alone, ten minutes, immediately noticeable.
2. `Plant` transitions + reduce-motion; remove reanimated.
3. `STAGES` unification.
4. Milestone detection, ledger and screen.

### Verification

- A quantified habit taps 1/8 → 8/8: light ticks on the way, one success notification on the tap that fills it, nothing on the ninth tap.
- Completing a habit visibly grows the plant rather than swapping it; with reduce-motion on, it cross-fades and nothing springs.
- Crossing 10 days shows the moment exactly once — not again on the next launch, not again after a pull-to-refresh, and not for the streak that was already past 10 when the feature shipped (backfill the ledger from current streaks on first run, or the feature spams every existing user on upgrade).
- `npx expo start --clear` builds with reanimated uninstalled (proving it really was dead).
- Streak drops to 0 and climbs back to 10 → the moment shows again (the ledger tracks the highest _celebrated_, and re-earning it is worth acknowledging — decide this explicitly and write the test that pins it).

---

## 7. Feature 5 — Export your garden

**Why:** deletion shipped; portability didn't. "You can erase it but you can never have a copy" is the wrong half of data ownership to implement first, and for a tracker whose whole value is a two-year history, export is also the answer to "what if I stop trusting this app".

**Crux:** the API is month-scoped by design ([habits.controller.ts](../apps/api/src/habits/habits.controller.ts) `GET /habits?year&month`), so a complete export is N requests, and focus sessions have no per-row endpoint at all — only aggregates.

### Decisions

**D5.1 — JSON for completeness, CSV for spreadsheets. Both.** JSON mirrors the API shapes (habits with logs, skips, notes, focus sessions) and round-trips if an import ever exists. CSV is one row per (habit, date, amount, completed, skipped) because that is what someone actually opens in Sheets. _Rejected:_ CSV only. It cannot express notes and focus sessions without three more files.

**D5.2 — Hand the file to the OS share sheet, don't email it.** `expo-file-system` writes to the cache directory, `expo-sharing` opens the sheet; the user picks Drive, Files, Mail, whatever. _Rejected:_ mailing it from the server. It needs the mail infrastructure Feature 1 introduces, it puts personal data through a third party, and it turns a two-second local action into a job queue.

**D5.3 — Fan out month queries on the client first; add a range endpoint only if it hurts.** [useHabitsHistory](../apps/mobile/src/api/hooks.ts) already fans out `["habits", year, month]` queries and shares their cache, so the export can reuse the pattern from `me.createdAt` to today. A two-year account is ~24 requests, run once, on demand. _Rejected:_ building `GET /habits/range` up front. It is a new endpoint, a new DTO, and a new caching story to save a handful of requests on a user-initiated action — and if it _does_ hurt, the same client code swaps to it later without changing the file format.

**D5.4 — Focus sessions need a real endpoint; notes already have one.** `GET /focus/stats` returns aggregates only ([focus.controller.ts:20](../apps/api/src/focus/focus.controller.ts#L20)). Add `GET /focus/sessions?year&month` (mirroring the notes shape) rather than reconstructing sessions from a heatmap. `GET /notes?year&month` is already right. _Rejected:_ excluding focus sessions. They are user-generated history; "all my data" that quietly means "most of it" is worse than no export.

**D5.5 — Export what the server has, not what the cache has.** Refuse while offline with a clear reason, and refuse while the outbox is non-empty until it drains — otherwise the file omits changes the user made minutes ago. `useSyncView` already exposes pending state. _Rejected:_ exporting the cache. Silently incomplete data in a file the user keeps forever is the worst failure mode available here.

**D5.6 — No import.** Reading a file back means reconciling ids, merging logs and resolving conflicts — a bigger feature than this whole document. Export is a copy for the user, not a migration tool. Say so in the UI.

### Data model / API

- `GET /focus/sessions?year=&month=` → `FocusSession[]` for the user (D5.4). Additive; the `@@index([userId, year, month, day])` at [schema.prisma:158](../apps/api/prisma/schema.prisma#L158) already covers the query.

### Mobile

- `lib/export.ts` — gather (months × habits, notes, focus sessions), serialize JSON and CSV, write, share.
- Settings → DATA → "Export my data", with a format choice, a progress line while the months fetch, and the D5.5 guards.
- `expo-file-system` + `expo-sharing` added.

### Phases

1. `GET /focus/sessions` on the API.
2. `lib/export.ts` gather + JSON serializer, verified against a seeded account.
3. CSV serializer.
4. Settings entry, progress, offline/pending guards.

### Verification

- A 14-month account exports every month from `createdAt` forward, including months with no logs at all (a gap in the file is indistinguishable from a failed request otherwise).
- Quantified habits carry their `amount`; skipped days are marked as skipped and not as complete; partial days are not rounded to done. This is the same distinction [completion.ts](../apps/mobile/src/lib/completion.ts) centralizes — the export must call it rather than re-deriving.
- CSV opens in Sheets with correct headers and no comma injection from a habit named `Read, daily`.
- Offline → refused with a reason. Outbox non-empty → refused until drained, then succeeds.
- The share sheet appears on a real device (cache-dir permissions are the classic failure here, and they don't show up in Expo Go).

---

## 8. Feature 6 — Ship confidence: mobile in CI, and crash reporting

**Why:** `apps/mobile` is the largest app in the repo, is on version 2.0.0, has a native module, and **nothing checks it before it merges**. There is also no crash reporting in any of the three apps, so a widget-mirror exception on a Samsung launcher is invisible unless a user writes in. Both of these are cheap and both get more expensive the more features land on top.

**Crux:** mobile is deliberately outside the pnpm workspace ([pnpm-workspace.yaml](../pnpm-workspace.yaml)), so it cannot join the Turbo graph. It needs a sibling CI job, not a filter — which is exactly what the comment in [ci.yml](../.github/workflows/ci.yml) anticipated ("you can add more jobs later, e.g. a separate one for the mobile app").

### Decisions

**D6.1 — A second CI job with `npm ci` in `apps/mobile`.** `npx tsc --noEmit`, `npm test`, `npx expo lint`. Runs in parallel with the workspace job. _Rejected:_ folding mobile into the workspace to reuse the job. The exclusion exists for real Metro/pnpm symlink reasons, and CI convenience is not worth re-litigating it.

**D6.2 — `@sentry/react-native`, DSN from env, gated off in dev.** `tracesSampleRate: 0` (crashes, not performance — performance tracing is noise until there is a performance question), `sendDefaultPii: false`, and a `beforeSend` that scrubs anything token-shaped. Offline events queue and send on reconnect, which suits an offline-first app. _Rejected:_ shipping without it. A store-released app with a native module and no crash visibility is flying blind.

**D6.3 — Test the outbox and the reminder reconcile.** They are the two subsystems whose bugs are silent: an outbox op that never drains loses a day the user recorded, and a reminder reconcile that mis-diffs either nags or goes quiet. The pure maths has four test files; these have none. _Rejected:_ chasing component-render coverage first. The maths is already tested and the UI is the part a person notices is broken.

**D6.4 — Also add Sentry to `api` and `web`.** Same DSN project, three environments. Cheap while the decision is already being made. Keeps [mobile-audit-and-roadmap.md](mobile-audit-and-roadmap.md)'s Sprint-4 item from staying open forever.

### Phases

1. `mobile` CI job (types + tests + lint). Fix whatever it finds — assume it finds something.
2. Outbox + sync convergence tests (replay the same op twice, drop a permanent failure, survive a cold start with a full queue).
3. Reminder reconcile tests (desired-vs-actual diff, quiet hours, the iOS 56-notification budget).
4. Sentry in mobile, then api and web.

### Verification

- A PR that breaks a mobile type turns CI red.
- `npm test` in `apps/mobile` runs in CI and its failures block the merge.
- A deliberate throw in a release build appears in Sentry with a readable stack (source maps uploaded — this is the step that is always forgotten).
- No access token, refresh token or email appears in any captured event.

---

## 9. The next tier

Designed to the decision that blocks each one, not further. Each is a real feature; none of them beats §3–§8 for the next few weeks.

### 9.1 A widget you can tap to water

The widget draws correctly and does nothing. The blocker is not Kotlin, it is **write direction**: [mirror.ts](../apps/mobile/src/widget/mirror.ts) is deliberately one-way (JS → native, presentation only, one write point) and a tap on the home screen has to travel the other way with no JS runtime alive. The honest design is that the widget's `PendingIntent` writes an _intent to complete_ into the same `SharedPreferences` the mirror uses, redraws optimistically, and the app drains it into the outbox on next launch or via a `WorkManager` job that starts headless JS. **Decision to make first:** whether a habit can be completed while the app has never been foregrounded that day — if yes, this needs headless JS and it is a genuinely large feature; if no (drain on next launch), it is a medium one with a caveat the user will eventually notice. Recommendation: drain-on-launch, plus a same-day cap, and revisit if it annoys anyone.

### 9.2 iOS

Not buildable today: no `ios.bundleIdentifier` in [app.json](../apps/mobile/app.json), no `ios` block in any [eas.json](../apps/mobile/eas.json) profile. The app code is already platform-clean (the widget module is `requireOptionalNativeModule`, so it no-ops), so getting to a TestFlight build is mostly config, an Apple developer account, and the notification-budget code finally being exercised for real. The widget would need a full WidgetKit + App Group rewrite — a second native implementation of §9.1, not a port. **Decision to make first:** whether iOS ships without a widget. It should — the app is complete without it and the widget can follow.

### 9.3 Push, for the user who stopped opening the app

Local reminders can only fire on a device the app has recently foregrounded ([types.ts](../apps/mobile/src/notifications/types.ts): a 5-day horizon topped up on foreground). So the app cannot say anything to someone who has drifted for a week — the exact moment a habit tracker earns its keep. Needs a `PushToken` table, `expo-notifications`' push token registration, Expo's push service, and a scheduled server job. **Decision to make first:** what the message is. "You haven't logged in for 5 days" is a guilt notification and it churns people; "Your garden is wilting — 3 plants are waiting" uses the metaphor the product already owns. Get the copy right before building the scheduler, because the scheduler is the easy half.

### 9.4 Reorder habits

No `order` column, so Today's sections render in whatever order Postgres returns. `Habit.order Int @default(0)` + a `PATCH /habits/reorder` taking an id list + long-press drag on Today. The catch: Today groups by `tod` ([(tabs)/index.tsx](<../apps/mobile/src/app/(tabs)/index.tsx>)), so ordering is _within_ a routine, and dragging across a section boundary has to mean "change the habit's `tod`" or be forbidden. **Decision to make first:** which. Recommendation: forbid it, and let the habit sheet change `tod` — a drag that silently rewrites a habit's schedule is a surprise.

### 9.5 Accessibility and tap targets

Two of ~30 files have any accessibility labels; the completion toggle is 38 px ([HabitRow.tsx:154](../apps/mobile/src/components/HabitRow.tsx#L154)) and the tab bar's buttons are 40 px with no `hitSlop`. No decision needed — this is a mechanical pass: labels and roles on every icon-only control, `hitSlop` to the 44 pt floor, `accessibilityState` on toggles, and one pass with TalkBack actually switched on. It sits in tier C only because nothing is _broken_; it moves to tier A the moment the app is submitted to a store that reviews for it.

### 9.6 Share your streak

No `Share` call anywhere. A rendered card (the plant, the habit name, the streak, a small heatmap) via `react-native-view-shot` + `expo-sharing` is the only organic growth loop a solo habit app gets, and Feature §6's milestone moment is the natural place to offer it. **Decision to make first:** whether the card carries any branding or a link, because a share with nothing to click is a nice picture and no growth.

### 9.7 To-do list and stopwatch

Already tracked in [features-or-bugDoc.md](features-or-bugDoc.md) with the open question ("persist via API or local-only") still unanswered. Not re-planned here. Worth noting that the answer for the to-do list is probably "local-only until someone asks", and that the stopwatch is nearly free given [focus.tsx](../apps/mobile/src/app/focus.tsx)'s timestamp-based countdown already solves the hard part (surviving backgrounding).

### 9.8 `@repo/core`

[completion.ts](../apps/mobile/src/lib/completion.ts) and [deriveStats.ts](../apps/mobile/src/lib/deriveStats.ts) are still duplicated between mobile and web, and [next-four-features-plan.md](next-four-features-plan.md) records that they have already drifted once. Agreed as D8 in [quantifiable-habits-plan.md](quantifiable-habits-plan.md) and still open. The obstacle is the same one CI has: mobile is outside the pnpm workspace, so it cannot consume a workspace package without a publish step or a relative-path install. **Decision to make first:** whether to solve that, or to accept duplication and enforce it with a shared test vector file both apps run. The second option is unglamorous and would have caught the drift.

---

## 10. Sequencing

**Wave 1 — a weekend, no schema, no infrastructure.** §4 onboarding → §6 haptics (phase 1 only) → §5 account screen. All three are client wiring against endpoints that exist, and the first one changes what every new user sees in the first ninety seconds. Ship them in that order and stop; the rest of §6 can follow at any time.

**Wave 2 — before more features land.** §8, mobile in CI. Every feature after this one is cheaper to land safely with types and tests enforced, and the job takes an afternoon. Sentry immediately after, so Wave 1's changes are observable in the wild.

**Wave 3 — the locked door.** §3 password reset. It is last in this ordering only because it needs a provider decision and a production secret, not because it matters least — it is the one gap where a real user has no path forward. If the mail provider is already decided, it moves to Wave 1.

**Wave 4 — portability.** §7 export, after §3 (both touch trust, and §3 introduces the mail plumbing that makes a future "email me my export" trivial if it is ever wanted).

**Then the next tier**, in the order the decisions in §9 get made. If a store submission is on the calendar, §9.5 accessibility jumps the queue.

**Why onboarding first, concretely:** it is roughly forty lines, it needs no server change, and it is the difference between a new user's first screen saying "Your garden is empty" and showing them the four plants they just chose. Nothing else in this document has that ratio.

---

## 11. Out of scope (deliberate)

- **Social features — friends, feeds, leaderboards.** A different product with a different moderation, privacy and abuse surface. The share card in §9.6 is the whole social ambition this app needs.
- **Gamified currency, pets, avatars (the Habitica direction).** The plant _is_ the reward system. A second, numeric one would compete with it, and the metaphor is the app's only real differentiator.
- **AI habit suggestions.** Nothing in the data justifies it yet, and "you should meditate more" from an app is a worse experience than silence.
- **Apple Health / Google Fit integration.** Two native integrations, two permission models, and it only helps the subset of habits that are already measured by another device.
- **i18n.** Real, but it is a project (every string in ~30 screens) and there is no second-language user asking. Revisit when there is.
- **Biometric app lock.** The data is habits, not messages; `expo-secure-store` already protects the tokens. Reasonable to add, wrong to prioritize.
- **Web push / a PWA install prompt.** The mobile app is the mobile story.
- **Import.** See D5.6 — id reconciliation and conflict resolution is bigger than this whole document.
