/** TTLs in seconds. */
export const TTL = {
  authUser: 30,
  /** GET /users/me — invalidated on every profile/status mutation. */
  me: 300,
  /** Habits + logs for one month — invalidated via the user's version. */
  habits: 600,
  /** Focus stats for one (user, local day) — invalidated when a session is recorded. */
  focusStats: 600,
  /** Admin dashboard aggregates — changes with every log write; TTL-only. */
  adminStats: 30,
  /** Admin user list/detail — versioned, plus TTL to cover name/avatar
   *  edits and log activity that deliberately don't bump the version. */
  adminUsers: 60,
  /** Per-user payment history — invalidated when a payment is recorded. */
  adminPayments: 300,
  /** Published release per platform — every running app polls this, and it
   *  only changes when an admin publishes, so cache it hard and bust on write. */
  appRelease: 600,
} as const;

export const cacheKeys = {
  /** User row as seen by JwtStrategy.validate (id/email/role/status/tokenVersion). */
  authUser: (userId: string) => `auth:user:${userId}`,

  /** GET /users/me response. */
  me: (userId: string) => `user:me:${userId}`,

  /** Version namespace covering all cached habit months of one user. */
  habitsVersion: (userId: string) => `habits:${userId}`,
  /** Subkey (joined with the version by CacheService) for one month view. */
  habitsMonth: (year: number, month: number) => `${year}-${month}`,

  /** Version namespace covering a user's focus stats. */
  focusVersion: (userId: string) => `focus:${userId}`,
  /** Subkey for the stats view anchored on one client-local day. */
  focusStatsDay: (year: number, month: number, day: number) =>
    `stats:${year}-${month}-${day}`,

  /** Admin dashboard aggregates. */
  adminStats: 'admin:stats',

  /** Version namespace covering the admin user list and user details. */
  adminUsersVersion: 'admin:users',
  /** Subkey for one page of the admin user list. */
  adminUsersList: (
    page: number,
    pageSize: number,
    status?: string,
    search?: string,
  ) =>
    `list:p${page}:s${pageSize}:${status ?? 'all'}:${encodeURIComponent(search ?? '')}`,
  /** Subkey for one user's admin detail view. */
  adminUserDetail: (userId: string) => `user:${userId}`,

  /** One user's payment list (admin view). */
  adminPayments: (userId: string) => `admin:payments:${userId}`,

  /** Replay marker for a consumed mobile Google sign-in code. */
  googleCodeUsed: (code: string) => `auth:gcode:${code}`,

  /** Currently published release for one platform. */
  appRelease: (platform: string) => `app:release:${platform}`,
} as const;
