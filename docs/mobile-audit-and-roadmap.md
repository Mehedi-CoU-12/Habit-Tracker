# HabitFlow Mobile — Feature Audit & Improvement Roadmap

> **Generated:** 2026-06-21 · **Scope:** `apps/mobile` (primary), with `apps/api` and monorepo DX where relevant.
> **How to use this doc:** Sections 1–8 are the findings. Section 9 is the execution plan — tick the `- [ ]` boxes as you complete them. File references are `path:line`.

> ⚠️ **Largely superseded — read the verdict below as history, not as the current state.**
> Written before reminders, real heatmaps, the Stats period switcher, offline sync, Google sign-in,
> scheduling and archiving shipped. Most of what it calls "demo-ware" or missing now exists. The
> parts that still stand: no in-app account deletion (a store-submission blocker), and `deriveStats`
> duplicated between web and mobile. For current work see
> [features-or-bugDoc.md](features-or-bugDoc.md).

> **Headline verdict:** HabitFlow has a distinctive, polished "Bloom" identity and a clean layered architecture — but several prominent features are **demo-ware**: onboarding collects your habits then throws them away, two heatmaps render _fabricated_ data, the reminder toggles and the Stats period switcher do nothing, and the #1 habit-tracker feature (notifications) doesn't exist. There is also a **hard App/Play Store ship-blocker**: no in-app account deletion. Many of the highest-value fixes are _pure wiring_ against a backend that already supports them.

---

## 1. Project Overview

**What it is.** A daily habit tracker built around the metaphor that each habit is a plant that grows (seed → sprout → bloom) as you keep a streak; the home screen is a "garden." Thin Expo/React Native client over a shared NestJS + Prisma/PostgreSQL backend (same API powers a Next.js web app). All streak/completion math runs on-device.

**Target users.** Individuals who want a lightweight, emotionally rewarding personal tracker — motivated by visual progress (growing plants, streaks, %) rather than heavy analytics. Single-user, account-gated (email/password JWT).

**Tech stack.** Expo SDK 54, React Native 0.81, expo-router v6, TanStack Query v5, expo-secure-store, react-native-svg, (reanimated — installed but unused). Backend: NestJS, JWT (7-day) + Google OAuth, Prisma/PostgreSQL, Cloudinary avatars.

**Core workflows.** Sign up → 3-step onboarding → Today garden; one-tap daily completion (optimistic); add/edit/delete habits via a modal; habit detail with growth stage + streak; month calendar with completion rings; Stats/Insights; Settings (appearance, avatar, sign out).

**Architecture map.** `apps/mobile/src/api/client.ts` transport → `endpoints.ts` → `hooks.ts` (TanStack Query) → screens. Theming is a single token object via `theme/ThemeProvider.tsx`. Stats derived by the pure `lib/deriveStats.ts`.

---

## 2. Existing Features List

**Fully working**

- Email/password auth (login/signup with client validation), redirect-based auth gate (`app/_layout.tsx:22`)
- Habit create / edit / delete (modal at `app/add.tsx`; delete with confirm at `app/habit/[id].tsx:70`)
- One-tap daily completion toggle, optimistic with rollback (`api/hooks.ts:34`)
- Today garden + routine-grouped list, with loading/error/empty states (`app/(tabs)/index.tsx`)
- Habit detail: growth-stage plant, streak/best/rate cards, sparkle reward
- Calendar month view with per-day completion rings (read-only)
- Plant/Bloom growth visualization (5 stages by streak) (`components/Plant.tsx`)
- Client-side stats derivation (streak/best/rate/doneToday)
- Profile display + avatar upload
- Appearance settings: dark mode, accent, density, Today layout — all persisted
- Custom floating tab bar with center Add button; sign out (clears token + cache)
- JWT in secure storage; custom font loading

**Half-built / fake (⚠️ look finished but aren't)**

- **Onboarding** — collects seed/routine picks then discards them (`app/onboarding.tsx:65`)
- **Reminders** — Settings + onboarding toggles are hardcoded-on, no handler, schedule nothing
- **Both heatmaps** — render seeded pseudo-random data, not real logs (`app/(tabs)/stats.tsx:15`, `app/habit/[id].tsx:40`)
- **Stats period switcher** — Week/Month/Year is read only for highlight styling; every metric is always current-month
- **Dead code** — `api.applyTemplate` defined with zero callers; `KEYS.onboarded` declared but never read/written; reanimated installed but unused

---

## 3. Feature Categorization

| Category                   | Features                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core (the value)**       | Habit CRUD · daily completion toggle · Today garden · habit detail w/ growth & streak · Plant visualization · client stats (streak/best/rate) · Calendar month view                                                                                                                                                              |
| **Supporting (usability)** | Email/password auth · profile + avatar upload · appearance settings · floating tab bar · sign out · calendar day-detail list · Today loading/empty/error states                                                                                                                                                                  |
| **Technical (infra)**      | Secure-store JWT persistence · redirect auth gate · fetch wrapper w/ typed `ApiError` · TanStack Query setup · optimistic mutations + invalidation · token-driven theme system · reusable primitives + SVG icon set · custom font loading                                                                                        |
| **Missing but expected**   | Reminders/notifications · onboarding that creates habits · 401/expired-token handling · timezone-correct "today" · cross-month streaks/real history · functional period switcher · backfill from calendar · profile/password editing · Google sign-in · offline support · pull-to-refresh · accessibility · **account deletion** |

---

## 4. Missing Features (gap analysis vs. Streaks / Loop / Habitica / Productive)

**Ship-blockers / critical**

- 🚫 **In-app account deletion** — _required_ by App Store Guideline 5.1.1(v) and Google Play for account-creating apps; also GDPR/CCPA erasure. No `DELETE /users/me`, no User soft-delete field. **Cannot pass store review without this.**
- **Reminders/notifications** — entirely absent (expo-notifications not installed); the loop _remind → complete → progress_ is the heart of every competitor.
- **401/expired-token handling** — a 7-day JWT silently expiring strands the user on a broken shell with no path back to login (web handles this; mobile doesn't).

**Major functional gaps**

- **Flexible scheduling** (specific weekdays / N-times-per-week) — model has only a monthly `goal Int` + free-string `tod`; daily-only also unfairly breaks streaks for M/W/F habits.
- **Cross-month streaks & real history** — `GET /habits` is month-scoped, so a streak across a month boundary reads as broken on the 1st and "best" can't exceed ~31.
- **Quantifiable habits** (count/duration, "5 of 8 cups") — `HabitLog` is existence-only; the "8 cups"/"30 min" verbs are decorative.
- **Backfill from Calendar** — read-only; can't fix a forgotten yesterday (backend already accepts any day).
- **Google sign-in on mobile** — backend supports it; Google-only accounts literally cannot log in on mobile.
- **Profile/password editing** — `PATCH /users/me` exists and web uses it; mobile only uploads an avatar.

**Platform/operational**

- Offline support / cache persistence · pull-to-refresh + retry · habit reorder/archive/pause · multi-device conflict handling · data export/backup · auth rate-limiting · DB indexes on FK columns.

---

## 5. Feature Improvement Suggestions (existing features)

- **Onboarding** → _current:_ discards selections. _Improve:_ in `done()` create the picked seeds via `useCreateHabit` or call `applyTemplate` (the dead client fn), show a loading state, write `KEYS.onboarded`, then land on a _populated_ garden. **Best practice:** first-session habit creation is the strongest D1-retention predictor.
- **Completion toggle** → _current:_ visual-only + silent rollback. _Improve:_ add `Haptics.impactAsync` on check-off, and a toast on the silent optimistic-rollback failure case.
- **Stats** → _current:_ fake heatmap + inert period switcher. _Improve:_ drive both from a real multi-month logs query; if not ready, _remove_ them rather than ship fake data.
- **Calendar** → _current:_ read-only. _Improve:_ make selected-day rows `Pressable` → `useToggleLog` with the _selected_ day (not `now.getDate()`). Pure client change.
- **Auth screens** → add `textContentType`/`autoComplete` (autofill), a show/hide toggle, inline validation, and a "Forgot password?" entry.
- **Plant** → animate the grow/wilt transition with the _already-installed_ reanimated — the signature reward moment is currently static.
- **Sign out** → add a confirmation `Alert` (it currently fires instantly, unlike the carefully-confirmed delete).

---

## 6. New Feature Roadmap

### 🔴 High Priority (must-have)

| Feature                                                                                  | Effort | Why                                                                                 |
| ---------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| In-app account deletion (DELETE /users/me + Settings flow)                               | S–M    | **Store-approval blocker** + GDPR; cascade delete already exists.                   |
| Wire onboarding to create habits (+ write `onboarded` flag)                              | M      | Highest-leverage retention fix; backend + dead `applyTemplate` ready — pure wiring. |
| Centralized 401 handling → auto sign-out + redirect                                      | S      | Mirror web's `api.ts:24`; ~15 lines.                                                |
| Auth hardening: rate-limit `/auth/*` (@nestjs/throttler) + validate `JWT_SECRET` at boot | S      | Open to credential-stuffing today; unset secret silently signs tokens.              |
| Enforce HTTPS for non-loopback hosts under `!__DEV__` + ATS/cleartext config             | S      | Bearer token rides cleartext today.                                                 |
| Multi-month / date-range logs query (backend)                                            | M      | **Unblocks 4 items below** — sequence first.                                        |
| Local reminder notifications (expo-notifications)                                        | L      | The #1 habit feature; currently faked.                                              |
| Real heatmaps (replace `buildYearData`)                                                  | M      | Depends on range query; stop shipping fake history.                                 |
| Cross-month streaks in `deriveStats`                                                     | M      | Depends on range query; streaks are the core motivator.                             |

### 🟡 Medium Priority (should-have)

Interactive calendar backfill (S, no API change) · functional period switcher (depends on range query) · profile/password editing (S, backend ready) · Google sign-in + deep-link callback (L — _don't_ reuse the web `?token=` callback) · consistent loading/error + pull-to-refresh (M) · timezone-correct "today" helper (M) · offline/query persistence (M) · accessibility pass (M) · flexible scheduling (XL, schema migration) · Sentry across all apps (M) · extract `@repo/core` shared package + tests (L) · CI pipeline incl. mobile (M).

### 🟢 Low Priority (nice-to-have)

Animated plant bloom (M) · quantifiable habits (L, migration) · reorder/archive/pause (L, migration) · edit-by-id fetch fallback (S) · sign-out confirm + auth polish (S) · list virtualization (M) · split theme/prefs context (S) · forward AbortSignal (S) · backend date validation (S) · project hygiene: README/env-examples/JWT_EXPIRE/Dockerfile (M) · dark-mode/contrast + label truncation (S).

---

## 7. Technical Improvements

- **Correctness (high):** No 401 handling (`api/client.ts:34`). Timezone — "today" is raw device-local calendar day across 4 screens, sent as bare `year/month/day` ints with no UTC/timezone column → midnight/travel double-counts. Streaks structurally capped to one month.
- **Data integrity (medium):** Two heatmaps show fabricated data; `ToggleLogDto.year` unbounded and `day` allows Feb 30 (mis-feeds stats).
- **Performance:** Zero list virtualization — every list is `.map()` in a `ScrollView`, each row mounts its own `Sparkles` Animated + multi-node SVG (fine now, fragile at 30–50 habits). `useTheme()` subscribes to the whole Bloom context, so a _layout_ toggle re-renders every themed component. No `AbortSignal` forwarding. No offline/query persistence. **DB:** no `@@index` on `Habit.userId` / `HabitLog.userId` → sequential scans at scale.
- **Architecture:** `deriveStats` + contract types are **duplicated across web/mobile and have already diverged**; reanimated is dead weight. No multi-device concurrency story (blind last-write-wins).

---

## 8. UX/UI Improvements

- **Accessibility (high):** _Zero_ `accessibilityLabel/Role/State` anywhere — icon-only controls (tabs, `+`, toggle, edit/delete, swatches, picker) are invisible to VoiceOver/TalkBack. No dynamic-type. Several targets below 44pt with no `hitSlop` (toggle 38px, tabs 40px, swatches 22px, avatar badge 20px).
- **Honesty/feedback (high):** Onboarding broken promise; decorative reminder toggles + inert period switcher imply guarantees that don't hold; no haptics/toasts on key actions; silent optimistic rollback.
- **Error coverage (high):** Only Today shows load errors — Calendar/Stats/Settings silently render empty/zeroed UI on failure (indistinguishable from an empty account); no retry/pull-to-refresh; Today's error leaks a dev hint.
- **Friction (medium):** Read-only calendar (no backfill); no Google sign-in / forgot-password; view-only profile; instant sign-out; Add modal lacks `KeyboardAvoidingView`/`keyboardShouldPersistTaps`.
- **Polish (low):** Static plant (no bloom animation); a few non-themed colors + low-contrast inactive tabs; grid/Stats names truncate to one line; onboarding step indicator off-by-one with no back/skip.

---

## 9. Final Action Plan (sequenced — tick as you go)

### Sprint 0 — Ship-readiness & safety

- [ ] `DELETE /users/me` + Settings "Delete account" flow with confirm — **unblocks store submission**
- [ ] Centralized 401 → `signOut()` in `api/client.ts` (mirror web)
- [ ] Auth hardening: `@nestjs/throttler` on `/auth/*`; validate `JWT_SECRET`/`DATABASE_URL` at boot
- [ ] Enforce HTTPS for non-loopback hosts under `!__DEV__`; Android cleartext / iOS ATS config
- [ ] Decide per fake feature: **wire or remove** (period switcher, reminder toggles, heatmaps)

### Sprint 1 — Activation & the core loop

- [ ] Wire onboarding to create habits via `applyTemplate`/`createHabit` + write `onboarded` flag
- [ ] Local reminder notifications (expo-notifications + plugin/permissions + persisted `reminderTime`); wire existing toggles
- [ ] Accessibility + tap-target pass (so the loop is usable, not just functional)

### Sprint 2 — Honest data (do the range query first — it unblocks the rest)

- [ ] Backend multi-month / date-range logs query
- [ ] Real heatmaps (replace `buildYearData`)
- [ ] Cross-month streaks in `deriveStats`
- [ ] Functional Stats period switcher
- [ ] Timezone-correct single "day" helper at write + read boundaries

### Sprint 3 — Reliability & parity

- [ ] Interactive calendar backfill (no API change)
- [ ] Profile/password editing (wire `PATCH /users/me`)
- [ ] Consistent loading/error states + pull-to-refresh + retry
- [ ] Offline cache persistence (react-query-persist-client + NetInfo)
- [ ] Google sign-in (PKCE via expo-auth-session — **not** the web `?token=` callback)

### Sprint 4 — Foundations & scale

- [ ] Extract `@repo/core` (deriveStats + types) + **unit tests** on streak math
- [ ] CI pipeline that **includes mobile** (currently outside workspace AND Turbo graph — no enforced lint/type-check)
- [ ] Sentry across all three apps
- [ ] DB indexes on `Habit.userId` / `HabitLog.userId`
- [ ] Project hygiene: README, env-examples, `JWT_EXPIRE` wiring, Dockerfile, root package name, remove `packages/ui` stubs
- [ ] Larger bets: flexible scheduling (schema) · quantifiable habits · reorder/archive/pause · animated bloom · list virtualization

---

### Accuracy notes

- The Stats `period` state _is_ read — but only for segment highlight styling, never for any metric.
- The committed `.env` pointing at an `http://` LAN IP is a _dev_ config; the real production control is the `!__DEV__` HTTPS guard, so don't overstate it as a live prod leak.
- `KEYS.onboarded` (`lib/storage.ts:34`) exists but is never read/written — evidence the activation loop was planned and dropped.
- `expo-linking` is an installed dependency, just unused (no `Linking` handler in code).
