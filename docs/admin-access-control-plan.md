# HabitFlow — User Roles, Approval Gate & Admin Dashboard: Design Plan

> **Generated:** 2026-07-03 · **Scope:** `apps/api` (enforcement core), `apps/web` (admin dashboard + gate), `apps/mobile` (gate) · **Status:** proposal — no code changed yet.
> **How to use this doc:** Sections 1–7 are the design with decisions and rationale. Section 8 is the execution plan in implementation order — tick the `- [ ]` boxes as you complete them. Section 9 is the verification matrix to run before calling it done.

> **Headline:** Everything the product needs already exists _except_ access control: today, **anyone who signs up (email or Google) gets a working 7-day token instantly**, tokens are never re-checked against the database, and only 2 of 4 controllers have any guard at all. The plan adds two fields (`role`, `status`) and flips the API from "opt-in guards" to "locked by default", then builds the admin surface on top. The API is the only real enforcement point — both clients keep tokens in local storage with purely client-side redirects, so client checks are UX, not security.

---

## 1. Requirements → features

| Your requirement                                                            | Feature in this plan                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| "user types so that i can distinguish admin and normal users"               | `User.role` enum: `USER` / `ADMIN` (§4)                                                                                                     |
| "admin dashboard from where i can monitor everything, everybody's progress" | `/admin` section in the web app + admin API endpoints (§5.2, §6.2)                                                                          |
| "if someone installs it but won't use it if i'm not allowing (web too)"     | `User.status` enum: `PENDING` / `ACTIVE` / `SUSPENDED`; new signups start `PENDING` and are blocked by the API until approved (§3-D1, §5.1) |
| "make guard in every query"                                                 | Global guard stack (`APP_GUARD`) — every endpoint is protected unless explicitly marked `@Public()` (§5.1)                                  |
| "if i took cash then i allow them from my dashboard"                        | Approve button in the users table + a `Payment` ledger recording amount/note at approval time (§4, §6.2)                                    |

---

## 2. Where the code stands today (recon facts the design is built on)

**API (NestJS 11, Prisma 7, Postgres/Neon):**

- JWT payload is `{ sub, email }`, 7-day expiry; `JwtStrategy.validate()` does **zero DB lookup** — a token issued once works until expiry no matter what happens to the account.
- Guards are **opt-in**: `JwtAuthGuard` (a bare `AuthGuard('jwt')` subclass) is applied class-level on `HabitsController` and `UsersController` only. No `APP_GUARD`, no roles guard, no custom decorators exist.
- `User` model has no role/status/approval fields. Both user-creation paths (`signup()`, `googleLogin()`) immediately return a signed token → instant full access.
- 15 endpoints total (2 app + 4 auth + 3 users + 6 habits); public ones: `GET /`, `GET /health` (used by Render health check **and** the keep-alive self-ping — must stay public), and the 4 `/auth/*` routes.
- Errors are normalized by a global `AllExceptionsFilter` into `{ statusCode, error, message }` — any new field (like a machine-readable `code`) must be passed through there.
- No pagination, no aggregates, no cross-user queries anywhere. The one read query, `getHabitsWithLogs(userId, year, month)`, is already parameterized by `userId` — reusable as-is for an admin viewing any user.
- Streak/completion math is **client-side** (`deriveStats.ts`, duplicated in web and mobile), month-scoped.
- `PrismaService` exposes models via explicit getters (`user`, `habit`, `habitLog`) — new models need a getter added. Global `ValidationPipe({ whitelist, forbidNonWhitelisted })` — every new DTO field must be decorated.
- Render runs `prisma migrate deploy` at **every boot** (free plan has no pre-deploy hook), so merging a migration to `main` auto-applies it in production. Render free tier has no shell — one-off scripts run locally against the Neon `DATABASE_URL`.

**Web (Next.js 16 App Router, all client components):**

- Token in `localStorage["accessToken"]`; no cookies, no `middleware.ts` → **server-side route gating is impossible today**; all gating is client-side.
- One response funnel (`handleResponse` in `src/lib/api.ts`): 401 → wipe token + hard redirect to `/login` (except on `/`, `/login`, `/signup`); **403 has no handling** — it surfaces as a generic toast or the dashboard's misleading "API not running" banner.
- `UserProfile` from `/users/me` has no role/status. Signup and Google callback drop the user straight into `/dashboard`.
- Reusable UI: `OverviewCard`, `ConfirmDialog`, recharts wrappers (`DailyLineChart`, `DonutChart`), raw-table patterns in `HabitGrid`. No generic table, no admin scaffolding, `@repo/ui` is unused starter boilerplate.

**Mobile (Expo SDK 54, expo-router v6):**

- Token in `expo-secure-store` (`habitflow.token`); `AuthGate` in `src/app/_layout.tsx` redirects on **token presence only** — no status concept, no startup validation.
- One central choke point exists: `handle()` in `src/api/client.ts` throws `ApiError(message, status)` for every response — but nothing consumes errors globally, and most screens silently render empty on error. A 403 today is **invisible** on most screens.
- Email/password only (no Google on mobile). Signup routes to a cosmetic onboarding, then the tabs.

---

## 3. Key design decisions

- **D1 — Two orthogonal fields, not one enum.** `role` (what you can do: `USER`/`ADMIN`) and `status` (whether you may use the app at all: `PENDING`/`ACTIVE`/`SUSPENDED`). Approval and permissions are independent axes; conflating them (e.g. `PENDING_USER`, `ACTIVE_ADMIN`, …) explodes combinatorially.
- **D2 — Token validation hits the database.** `JwtStrategy.validate()` will `findUnique` the user and attach `{ id, email, role, status }` to the request. This is the linchpin: without it, a user you suspend keeps a working token for up to 7 days, which defeats the entire "I control who uses it" requirement. Cost: one indexed primary-key query per request — negligible at this scale, and it doubles as "deleted user ⇒ instant 401". The alternative (baking status into the JWT) was rejected for exactly the staleness reason.
- **D3 — Locked by default, opened explicitly.** Register the guard stack globally (`APP_GUARD`): `JwtAuthGuard` → `StatusGuard` → `RolesGuard`. Routes opt _out_ with `@Public()` (health, auth) or relax with `@AllowInactive()` (see D4). This is the literal answer to "make guard in every query": any endpoint added in the future is born protected.
- **D4 — PENDING users can log in; they just can't do anything.** Signup/login still issue tokens, but `StatusGuard` blocks every route except `GET /users/me` (marked `@AllowInactive()`). Clients use that one endpoint to show a "waiting for approval" screen and poll it — the moment you approve someone, their existing session unblocks **without re-login** (thanks to D2). Blocking login entirely was rejected: the user couldn't see _why_ they're blocked, and approval would require them to log in again.
- **D5 — Gate responses are `403` with a machine-readable `code`.** `{ statusCode: 403, error: "Forbidden", message: "Your account is awaiting approval.", code: "ACCOUNT_PENDING" | "ACCOUNT_SUSPENDED" }`. Not 401 — the web client's 401 handler wipes the token and redirects to login, which would trap pending users in a loop. `AllExceptionsFilter` needs a one-line change to pass `code` through.
- **D6 — Admin dashboard lives inside `apps/web` under `/admin`.** Reuses the Bloom design system, toast system, react-query setup, api client, and the existing Vercel deployment. A separate app would duplicate all of that for zero benefit. The client-side role check (`me.role !== "ADMIN"` → redirect) is cosmetic; the API's `RolesGuard` is the actual boundary.
- **D7 — Progress monitoring reuses what exists instead of building a stats engine.** `GET /admin/users/:id/habits?year&month` returns the **same payload shape as `GET /habits`** (internally calls the same `getHabitsWithLogs`, just with the target user's id). The admin UI then reuses the dashboard's `deriveStats` + chart components unchanged. Server-side aggregates are added only where per-user reuse can't work: the overview counters and the per-row `lastActiveAt`/`habitCount` in the users table (simple Prisma `count`/`groupBy` — `HabitLog.userId` being denormalized makes these cheap).
- **D8 — Cash is recorded, not just implied.** Approving someone after taking cash writes a `Payment` row (amount, note, which admin recorded it, when). You'll thank yourself in three months when someone claims they paid. No online payment integration in v1 (future: bKash/Stripe, see §10).
- **D9 — Admins are protected from self-lockout by endpoint rules, not guard exceptions.** `StatusGuard` requires `ACTIVE` for everyone including admins (no special-casing); instead, `PATCH /admin/users/:id/status` refuses to change **your own** status or another **ADMIN**'s status. The promote script always sets `role=ADMIN, status=ACTIVE`.

---

## 4. Data model changes (Prisma)

```prisma
enum Role {
  USER
  ADMIN
}

enum AccountStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

model User {
  // ... existing fields unchanged ...
  role            Role          @default(USER)
  status          AccountStatus @default(PENDING)
  statusChangedAt DateTime?     // when approved/suspended
  statusChangedBy String?       // admin user id (informational, not a relation)
  statusNote      String?       // e.g. "paid 500tk cash, June"
  payments        Payment[]

  @@index([status])
  @@index([createdAt])
}

model Payment {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  amount       Int      // whole Taka
  currency     String   @default("BDT")
  method       String   @default("CASH")
  note         String?
  recordedById String   // admin who recorded it
  createdAt    DateTime @default(now())

  @@index([userId])
}
```

**Migration & backfill — the one trap:** adding `status` with `@default(PENDING)` fills **existing** rows with `PENDING`, which would lock out every current user (including you) the moment the API enforces it. Create the migration with `--create-only` and append a backfill before applying:

```sql
-- appended to the generated migration.sql
UPDATE "User" SET "status" = 'ACTIVE';
```

New rows still default to `PENDING` (the Prisma-level default applies at insert time). Because Render runs `migrate deploy` at boot, merging this to `main` applies it in production automatically — the backfill must ship **in the same migration**, not as a follow-up.

**Admin bootstrap:** Render free tier has no shell, but Neon is reachable from your machine. Add `apps/api/scripts/promote-admin.ts` and run it locally with the production `DATABASE_URL` in the env:

```bash
pnpm --filter api add -D tsx     # one-time: tsx is not in the repo, and ts-node 10 can't run ESM TypeScript on modern Node
DATABASE_URL="postgresql://…neon…" pnpm --filter api exec tsx scripts/promote-admin.ts you@email.com
```

Two Prisma-7 gotchas for the script: the datasource block has no `url` (driver-adapter setup), so a bare `new PrismaClient()` won't connect — construct it exactly like `PrismaService` does, `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` — and import the client from `../generated/prisma/client.js`. The script sets `role=ADMIN, status=ACTIVE`. Explicit script > magic `ADMIN_EMAILS` env, so there's exactly one way admins come into existence.

**Plumbing:** add a `payment` getter to `PrismaService` (it exposes models via explicit getters).

---

## 5. API changes

### 5.1 Guard architecture (the core of the whole feature)

```
request
  → JwtAuthGuard   (global) — skipped for @Public(); else verifies token
  → JwtStrategy.validate()  — DB lookup → req.user = { id, email, role, status }; 401 if user gone
  → StatusGuard    (global) — skipped for @Public()/@AllowInactive(); 403 + code unless status === ACTIVE
  → RolesGuard     (global) — only acts when @Roles(...) metadata present; 403 unless role matches
  → handler
```

New files in `apps/api/src/auth/`: `public.decorator.ts`, `allow-inactive.decorator.ts`, `roles.decorator.ts` (all `SetMetadata` + read via `Reflector`), `status.guard.ts`, `roles.guard.ts`. `JwtAuthGuard` gets the standard `canActivate` override that returns `true` for `@Public()` routes. All three guards registered as `APP_GUARD` providers in `app.module.ts`; the class-level `@UseGuards(JwtAuthGuard)` on habits/users controllers becomes redundant and is removed.

**Route classification (every endpoint, per "guard in every query"):**

| Route                                                                                    | Marking                                                                                             |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /`, `GET /health`                                                                   | `@Public()` — health is pinged by Render **and** KeepAliveService; breaking it kills the deployment |
| `POST /auth/signup`, `POST /auth/login`, `GET /auth/google`, `GET /auth/google/callback` | `@Public()`                                                                                         |
| `GET /users/me`                                                                          | `@AllowInactive()` — the status-polling endpoint for gated clients                                  |
| All `/habits/*`, `PATCH /users/me`, `POST /users/me/avatar`                              | default: authenticated + ACTIVE                                                                     |
| All `/admin/*`                                                                           | `@Roles(ADMIN)` (+ ACTIVE, from the default stack)                                                  |

**Response contract changes:**

- `AllExceptionsFilter`: pass through an optional `code` field → gate errors are `403 { …, code: "ACCOUNT_PENDING" | "ACCOUNT_SUSPENDED" }`.
- The `user` object in `signup`/`login` responses and `GET /users/me` gain `role` and `status`. Email signup/login route on the response directly; **the Google flow cannot** — `googleLogin()` returns only a token and the callback redirect carries no user data, so the web callback page must store the token, then fetch `GET /users/me` (works while PENDING via `@AllowInactive`) and route on the returned status. That one flow needs the extra round trip.
- **While touching the Google callback:** switch the redirect from `?token=` query param to a `#token=` URL fragment, and have the callback page scrub it with `history.replaceState` after reading. Fragments are never sent to the server, so the token stops appearing in Vercel request logs and proxy history — this matters far more after this plan, because an ADMIN's Google-login token now unlocks _every_ user's data via `/admin/*`. (Keep query-param parsing as a fallback in the page for one release.)

### 5.2 Admin module (`apps/api/src/admin/`)

| Method & path                                      | Purpose                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /admin/stats`                                 | Overview counters: users by status, signups last 7 days (for the chart), total habits, logs today, distinct users active today                                                                                                                         |
| `GET /admin/users?status=&search=&page=&pageSize=` | Paginated user list (first pagination in the API: `skip`/`take`, `pageSize` clamped ≤ 100, returns `{ items, total, page, pageSize }`). Per row: id, name, email, avatarUrl, role, status, createdAt, habitCount, lastActiveAt (latest log), totalPaid |
| `GET /admin/users/:id`                             | Full profile + payments + status fields                                                                                                                                                                                                                |
| `GET /admin/users/:id/habits?year=&month=`         | **Same shape as `GET /habits`** — internally `getHabitsWithLogs(targetUserId, year, month)` (D7)                                                                                                                                                       |
| `PATCH /admin/users/:id/status`                    | Body `{ status, note? }`. Rules (D9): 400 if `id` is the caller; 403 if target is an ADMIN; stamps `statusChangedAt/By`, `statusNote`                                                                                                                  |
| `POST /admin/users/:id/payments`                   | Body `{ amount, note? }` — record cash taken                                                                                                                                                                                                           |
| `GET /admin/users/:id/payments`                    | Payment history for the user                                                                                                                                                                                                                           |
| `DELETE /admin/users/:id`                          | Remove junk/spam signups from the pending queue (Prisma `onDelete: Cascade` cleans habits/logs). Same safety rules as status changes: never self, never another ADMIN                                                                                  |

All DTOs fully decorated (global `forbidNonWhitelisted` rejects extras). The approve-with-payment flow is two calls from the UI (record payment → set ACTIVE), kept as separate endpoints so payments can also be recorded without a status change (e.g. renewals).

### 5.3 What deliberately does _not_ change

- Token issuance, expiry, CORS, existing habit/user endpoints' shapes — untouched. One deliberate exception in the Google flow: the callback redirect switches `?token=` to `#token=` (see §5.1). Existing ACTIVE users and both deployed clients keep working through the API deploy (see §8 rollout notes).

---

## 6. Web changes (`apps/web`)

### 6.1 The gate

- Extend `UserProfile` type with `role`, `status`.
- **New `/pending` page** (Bloom-styled): "Your account is awaiting activation — contact the admin." / suspended variant. Polls `["me"]` every 30 s + a "Check again" button; when status flips to `ACTIVE`, routes to `/dashboard`. Includes sign-out.
- **Do NOT add `/pending` to the 401 allowlist** in `api.ts`. If a PENDING user's 7-day token expires while they wait (realistic when approval means meeting you for cash), the existing 401 handler — wipe token, redirect to `/login` — is exactly the right behavior; suppressing it would trap them polling forever with a dead token. No redirect loop exists: `/login` is already allowlisted and terminal.
- **Central 403 handling** in `handleResponse`: if body `code` is `ACCOUNT_PENDING`/`ACCOUNT_SUSPENDED` and we're not already on `/pending` → redirect there. This also fixes the current bug where any 403 shows the dashboard's misleading "API not running" banner.
- **Status-aware routing after auth:** login/signup route on the response's `user.status` → `ACTIVE` ? `/dashboard` : `/pending`. `/auth/callback` (Google) reads the token from the URL fragment (query fallback), scrubs it via `history.replaceState`, fetches `/users/me`, and routes on its `status` — the Google redirect carries no user object (§5.1). Same status check for the `if (me) → /dashboard` redirects on `/`, `/login`, `/signup`.

### 6.2 Admin dashboard (`/admin`)

- **`app/admin/layout.tsx`** — client-side check: `me.role !== "ADMIN"` → `router.replace("/dashboard")` (UX only; API enforces). Navbar avatar menu gains an "Admin" item visible to admins.
- **`/admin` (overview)** — stat cards via `OverviewCard` (Pending approvals ⚠ / Active users / Signups this week / Active today) + signups-over-time line chart + status split donut (existing recharts wrapper patterns).
- **`/admin/users`** — the workhorse. Status filter tabs (**Pending (N)** first — that's the money queue), name/email search, pagination. Row actions: **Approve** (opens `ConfirmDialog`-based modal with optional payment amount + note → `POST payments` then `PATCH status`), **Suspend**, **Reactivate**. Raw-table pattern copied from `HabitGrid` (sticky column, `overflow-x-auto`).
- **`/admin/users/[id]`** — profile header (avatar, email, joined, status, total paid), `MonthSelector`, then **the user's progress exactly as they see it**: reuse `deriveStats` + `HabitGrid`/`DonutChart`/daily-chart components over the `/admin/users/:id/habits` payload. Payments list + "Record payment" button.
- New api-client functions + react-query keys: `["admin","stats"]`, `["admin","users",filters]`, `["admin","user",id]`, `["admin","user",id,"habits",year,month]`.

---

## 7. Mobile changes (`apps/mobile`)

Mobile gets the gate only — admin work happens on the web.

- Extend `UserProfile`/`AuthResult` types with `role`, `status` (login response's `user` is currently discarded; start using its `status`).
- **New `src/app/pending.tsx`** top-level route (sibling of `login`/`signup`): waiting-for-approval screen with pull-to-refresh/`refetch` of `useMe`, suspended variant, sign-out.
- **AuthGate third branch** in `_layout.tsx`, keyed on `useMe()` **data — not on "anything other than ACTIVE"**: with a token present, while the query loads show the splash; if `data.status` is `PENDING`/`SUSPENDED` and not already on `pending` → `router.replace("/pending")`; if on `pending` and it becomes `ACTIVE` → `router.replace("/")`. (`GET /users/me` works for gated users via `@AllowInactive` — that's the signal.) **Error paths are where naïve implementations misroute** (`useMe` is `retry: false` and mobile has zero 401 handling today): on `ApiError` with status **401** (expired/invalid token) call `signOut()` so the existing gate lands on `/login` — otherwise an expired-token user is trapped on the pending screen; on **network failure** stay on the splash/current screen and retry — never bounce an offline user to `/pending`.
- **Belt-and-suspenders:** extend `ApiError` with a `code` field (parse `body.code` in `handle()`), and on 403 `ACCOUNT_*` invalidate `["me"]` so the gate reacts mid-session (covers "admin suspends while the app is open"; most screens swallow errors silently, so the gate must not depend on per-screen handling). Plumbing note: the `QueryClient` is currently created with `useState` inside `RootLayout` and isn't importable from `client.ts` — hoist it to module scope (export it, pass to the provider) or register a callback from `AuthProvider`.
- **Signup flow:** after `register()`, route by `user.status` → `/pending` (skip onboarding; it's cosmetic today anyway).
- ⚠️ **Old installed builds** (no gate) will show silently-empty screens once the API starts returning 403s for pending/suspended users. Existing users are backfilled ACTIVE so nobody hits this on day one, but ship the mobile update in the same window as the API deploy.

---

## 8. Execution plan (implementation order)

Order rationale: schema first (everything depends on it), **API enforcement before any UI** (it's the security boundary; UI without it is theater), admin API before admin UI, clients last, mobile after web (web is also the admin tool you need first).

### Phase 1 — Data model & bootstrap (apps/api)

- [ ] Add `Role`, `AccountStatus` enums + `User` fields + `Payment` model to `schema.prisma`
- [ ] `prisma migrate dev --create-only` → append `UPDATE "User" SET "status" = 'ACTIVE';` → apply locally
- [ ] Add `payment` getter to `PrismaService`
- [ ] `pnpm --filter api add -D tsx` (script runner — see §4)
- [ ] `scripts/promote-admin.ts` (PrismaPg adapter construction per §4) + verify against local DB
- [ ] Regenerate client; typecheck passes

### Phase 2 — Guard core (apps/api) ← the security boundary

- [ ] `JwtStrategy.validate()` → DB lookup, attach `{ id, email, role, status }`, 401 on missing user
- [ ] `@Public()`, `@AllowInactive()`, `@Roles()` decorators; `StatusGuard`, `RolesGuard`; `JwtAuthGuard` respects `@Public`
- [ ] Register all three as global `APP_GUARD`s; remove now-redundant class-level `@UseGuards`
- [ ] Mark routes per the §5.1 table (don't forget `GET /health` — keep-alive depends on it)
- [ ] `AllExceptionsFilter`: pass through `code`; gate errors use `ACCOUNT_PENDING`/`ACCOUNT_SUSPENDED`
- [ ] Add `role`/`status` to `/users/me` and to the signup/login `user` payloads
- [ ] Google callback: redirect with `#token=` fragment instead of `?token=` query param (§5.1; pairs with the Phase 4 web change — both ship in the same merge)
- [ ] Verify matrix rows 1–4 (§9) locally with curl; exercise rows 5–6 by flipping `status` directly in the DB (Prisma Studio/psql) — the admin endpoint arrives in Phase 3, and DB-flipping actually tests the D2 "same token unblocks" property more purely

### Phase 3 — Admin API (apps/api)

- [ ] `AdminModule` with the 7 endpoints from §5.2, `@Roles(ADMIN)` class-level
- [ ] Pagination helper (`skip`/`take`, clamp, `{ items, total, page, pageSize }`)
- [ ] Stats queries (`count`/`groupBy` on `User`, `HabitLog` — logs carry `userId` directly)
- [ ] Status-change rules: reject self, reject other admins
- [ ] Verify matrix rows 7–9 with curl

### Phase 4 — Web gate (apps/web)

- [ ] `UserProfile` + `role`/`status`; `/pending` page with polling (no 401-allowlist entry — §6.1)
- [ ] `handleResponse`: 403 `ACCOUNT_*` → `/pending` (401 behavior unchanged: expired pending sessions belong on `/login`)
- [ ] Status-aware routing in login / signup / the three `if (me)` redirects
- [ ] `auth/callback`: parse `#token=` fragment (query fallback), `history.replaceState` scrub, fetch `/users/me`, route on status

### Phase 5 — Web admin dashboard (apps/web)

- [ ] `/admin` layout + Navbar "Admin" entry
- [ ] Overview page (stat cards, signups chart, status donut)
- [ ] Users table: filters, search, pagination, Approve-with-payment / Suspend / Reactivate actions
- [ ] User detail: progress view reusing dashboard components + payments panel

### Phase 6 — Mobile gate (apps/mobile)

- [ ] Types + `pending.tsx` + AuthGate status branch (on `data.status`, with the §7 error semantics)
- [ ] 401 → `signOut()` handling (mobile currently has none — expired tokens must land on `/login`, not `/pending`)
- [ ] `ApiError.code` + hoist/expose `QueryClient` + central 403 `["me"]` invalidation (§7 plumbing)
- [ ] Signup → `/pending` routing

### Phase 7 — Ship & verify

- [ ] Merge to `main` → Render boots with the migration (backfill included), Vercel redeploys web
- [ ] Run `promote-admin.ts` against the Neon production DB with your email
- [ ] Full §9 matrix against production; then release the mobile build

**Rollout safety:** deploy is a single merge because existing users are backfilled `ACTIVE` (unaffected) and old clients only misbehave for _new_ signups during the window between API deploy and client updates (web updates simultaneously on Vercel; mobile follows). No feature flag needed at this scale.

---

## 9. Verification matrix

| #   | Scenario                                                   | Expected                                                                                                                                 |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fresh signup (email) → call `GET /habits`                  | 403 `ACCOUNT_PENDING`                                                                                                                    |
| 2   | Same user → `GET /users/me`                                | 200, `status: "PENDING"`                                                                                                                 |
| 3   | Unauthenticated → `GET /health`, `/auth/login`             | 200 / normal (keep-alive alive)                                                                                                          |
| 4   | Unauthenticated → `GET /habits`                            | 401                                                                                                                                      |
| 5   | Admin approves user → user retries with the **same token** | 200 within one request (no re-login)                                                                                                     |
| 6   | Admin suspends an ACTIVE user with a live session          | Next request 403 `ACCOUNT_SUSPENDED`; web/mobile land on pending/suspended screen                                                        |
| 7   | Normal USER calls any `/admin/*`                           | 403                                                                                                                                      |
| 8   | Admin tries to change own status / another admin's status  | 400 / 403                                                                                                                                |
| 9   | Admin views `/admin/users/:id/habits`                      | Same shape as user's own `GET /habits`                                                                                                   |
| 10  | New Google signup (web)                                    | Lands on `/pending`, not `/dashboard` (callback fetches `/users/me` and routes on its status — the redirect itself carries no user data) |
| 11  | Existing pre-migration users after deploy                  | Untouched, everything works (backfill check)                                                                                             |
| 12  | Pending user polls on `/pending`, admin approves           | Auto-redirects to dashboard within ~30 s                                                                                                 |

---

## 10. Out of scope (deliberate), for later

- **Online payments** (bKash/SSLCommerz/Stripe) — the `Payment` model is the anchor to attach these to.
- **Time-boxed access** (`accessUntil` + expiry check in `StatusGuard`) — for "cash buys a month" instead of forever; trivial to add on this foundation.
- Email/push notification on approval ("you're in!").
- Audit-log table for admin actions beyond the status stamp fields.
- Admin management UI (promoting other admins) — script-only in v1 by design (D9).
- **Rate limiting on `/auth/*`** (`@nestjs/throttler`) — there is none today; a script spamming `/auth/signup` creates junk `PENDING` rows (each costing a server-side bcrypt hash) that bury the approval queue. `DELETE /admin/users/:id` (§5.2) is the manual cleanup valve until throttling lands.
- **Stolen-token recovery** — DB-backed validate covers _admin_-initiated revocation (suspend/delete), but a stolen token still survives the victim changing their password for up to 7 days. Fix when needed: a `passwordChangedAt` column stamped on password change, rejected in `validate()` when newer than the token's `iat` — rides the same `findUnique`.
- Refresh tokens / short-lived access tokens — not needed once the two items above exist.
