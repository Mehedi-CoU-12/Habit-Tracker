import {
    apiDelete,
    apiGet,
    apiPatch,
    apiPost,
    apiPut,
    apiUpload,
} from "./client";
import {
    AccountStatus,
    ApiDayNote,
    ApiHabit,
    FocusStats,
    UserProfile,
    UserRole,
} from "../lib/types";

// ── Auth ──────────────────────────────────────────────────────────────
export type AuthResult = {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
        role: UserRole;
        // ACTIVE for a new signup (auto-approved); the auth screens route on
        // this so a parked/suspended account still lands on /pending.
        status: AccountStatus;
    };
};

export function login(email: string, password: string) {
    return apiPost<AuthResult>("/auth/login", { email, password });
}

export function signup(name: string, email: string, password: string) {
    return apiPost<AuthResult>("/auth/signup", { name, email, password });
}

/**
 * Ask for a reset link. Resolves the same way whether or not the address is
 * registered — the API deliberately does not say, so neither can this screen.
 */
export function forgotPassword(email: string) {
    return apiPost<{ sent: boolean }>("/auth/forgot-password", { email });
}

/** Consume a reset link. Returns the address it belonged to, to sign in with. */
export function resetPassword(token: string, password: string) {
    return apiPost<{ success: boolean; email: string }>(
        "/auth/reset-password",
        { token, password },
    );
}

/** Revoke all sessions server-side (bumps tokenVersion). Idempotent. */
export function logout(refreshToken: string) {
    return apiPost<{ success: boolean }>("/auth/logout", { refreshToken });
}

/**
 * The exchange also reports whether it just created the account. Password
 * login and signup don't — the app already knows which of those it called.
 */
export type GoogleExchangeResult = AuthResult & { isNew: boolean };

/**
 * Trade the one-time code from the Google sign-in deep link for tokens +
 * user (see AuthProvider.signInWithGoogle for the full flow).
 */
export function googleExchange(code: string) {
    return apiPost<GoogleExchangeResult>("/auth/google/exchange", { code });
}

export function fetchMe() {
    return apiGet<UserProfile>("/users/me");
}

/**
 * Erase the account and everything cascading from it. Irreversible.
 *
 * A password account proves intent with its current password; a Google-only
 * account has none, so it sends the typed word DELETE instead. The server
 * decides which one this account owes.
 */
export function deleteAccount(input: {
    password?: string;
    confirmation?: string;
}) {
    return apiDelete<{ deleted: boolean }>("/users/me", input);
}

/** Picked image asset, as returned by expo-image-picker. */
export type AvatarAsset = {
    uri: string;
    mimeType?: string;
    fileName?: string;
};

export function uploadAvatar(asset: AvatarAsset) {
    const type = asset.mimeType ?? "image/jpeg";
    const name = asset.fileName ?? `avatar.${type.split("/")[1] ?? "jpg"}`;
    const form = new FormData();
    // The API's FileInterceptor expects the field name "avatar".
    form.append("avatar", {
        uri: asset.uri,
        name,
        type,
    } as unknown as Blob);
    return apiUpload<UserProfile>("/users/me/avatar", form);
}

// ── Habits ────────────────────────────────────────────────────────────
export function fetchHabits(year: number, month: number) {
    return apiGet<ApiHabit[]>(`/habits?year=${year}&month=${month}`);
}

export function createHabit(input: {
    // Optional client-generated id — supplied by the offline outbox so the
    // create is idempotent and the habit keeps a stable id from birth.
    id?: string;
    name: string;
    goal: number;
    icon?: string;
    tod?: string;
    verb?: string;
    target?: number | null;
    unit?: string | null;
    step?: number;
    fillFromFocus?: boolean;
    daysOfWeek?: number[];
}) {
    return apiPost<ApiHabit>("/habits", input);
}

export function updateHabit(
    id: string,
    input: {
        name?: string;
        goal?: number;
        icon?: string;
        tod?: string;
        verb?: string;
        target?: number | null;
        unit?: string | null;
        step?: number;
        fillFromFocus?: boolean;
        daysOfWeek?: number[];
        archived?: boolean;
    },
) {
    return apiPatch<ApiHabit>(`/habits/${id}`, input);
}

export function deleteHabit(id: string) {
    return apiDelete<void>(`/habits/${id}`);
}

export function toggleLog(
    habitId: string,
    year: number,
    month: number,
    day: number,
) {
    return apiPost<{ completed: boolean }>("/habits/logs/toggle", {
        habitId,
        year,
        month,
        day,
    });
}

/**
 * Idempotent absolute form of toggleLog — sets the (habit, date) completion to
 * an explicit boolean. The offline sync worker uses this so replays converge.
 */
export function setLog(
    habitId: string,
    year: number,
    month: number,
    day: number,
    completed: boolean,
) {
    return apiPut<{ completed: boolean }>("/habits/logs", {
        habitId,
        year,
        month,
        day,
        completed,
    });
}

/**
 * Absolute amount write for one (habit, date) cell. Zero clears the day; the
 * server derives completion against the habit's target.
 */
export function setLogAmount(
    habitId: string,
    year: number,
    month: number,
    day: number,
    amount: number,
) {
    return apiPut<{ amount: number; completed: boolean }>(
        "/habits/logs/amount",
        {
            habitId,
            year,
            month,
            day,
            amount,
        },
    );
}

/**
 * Spend or release one skip on a (habit, date) cell — streak insurance.
 * Absolute and idempotent like setLog, so an outbox replay converges to one
 * row. The monthly allowance is enforced server-side.
 */
export function setSkip(
    habitId: string,
    year: number,
    month: number,
    day: number,
    used: boolean,
) {
    return apiPut<{ used: boolean; remaining: number }>("/habits/skips", {
        habitId,
        year,
        month,
        day,
        used,
    });
}

export function applyTemplate(templateId: string) {
    return apiPost<{ created: number }>("/habits/apply-template", {
        templateId,
    });
}

// ── Focus sessions ────────────────────────────────────────────────────
export function recordFocusSession(input: {
    // Client-generated id — the outbox may replay this op after a crash, and
    // the server treats a known id as already-recorded (no double-count).
    id: string;
    habitId?: string;
    minutes: number;
    year: number;
    month: number;
    day: number;
}) {
    return apiPost<{ id: string }>("/focus/sessions", input);
}

/** year/month/day = this device's local today (the HabitLog convention). */
export function fetchFocusStats(year: number, month: number, day: number) {
    return apiGet<FocusStats>(
        `/focus/stats?year=${year}&month=${month}&day=${day}`,
    );
}

// ── App releases ──────────────────────────────────────────────────────
/** Published build for one platform; null when nothing has been published. */
export type AppRelease = {
    latest: string;
    minimum: string;
    url: string;
    notes: string | null;
    publishedAt: string;
} | null;

/**
 * Public endpoint — reachable signed out and from a build too old to
 * authenticate, which is exactly the case that needs to hear about an update.
 */
export function fetchAppRelease(platform: "android" | "ios") {
    return apiGet<AppRelease>(`/app/version?platform=${platform}`);
}

// ── Day notes ─────────────────────────────────────────────────────────────
export function fetchDayNotes(year: number, month: number) {
    return apiGet<ApiDayNote[]>(`/notes?year=${year}&month=${month}`);
}

/**
 * Absolute write for one day. Blank text clears the day, which is what makes
 * a replayed outbox op converge instead of duplicating or 404ing.
 */
export function setDayNote(
    year: number,
    month: number,
    day: number,
    text: string,
) {
    return apiPut<{ day: number; text: string | null }>("/notes", {
        year,
        month,
        day,
        text,
    });
}

// ── Admin (every route below requires role ADMIN — enforced by the API) ────
export type AppClientPlatform = "android" | "ios" | "web";

export type AdminStats = {
    totalUsers: number;
    usersByStatus: Record<AccountStatus, number>;
    totalHabits: number;
    logsToday: number;
    activeUsersToday: number;
    signupsLast7Days: { date: string; count: number }[];
};

export type AdminUserRow = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: UserRole;
    status: AccountStatus;
    createdAt: string;
    habitCount: number;
    /** Last authenticated request, not last habit logged. */
    lastActiveAt: string | null;
    lastAppVersion: string | null;
    lastAppPlatform: AppClientPlatform | null;
    totalPaid: number;
};

export type AdminPayment = {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    method: string;
    note: string | null;
    recordedById: string;
    createdAt: string;
};

export type AdminUserDetail = AdminUserRow & {
    statusChangedAt: string | null;
    statusChangedBy: string | null;
    statusNote: string | null;
    payments: AdminPayment[];
};

export type AdminUsersFilter = {
    status?: AccountStatus;
    search?: string;
    page?: number;
    pageSize?: number;
};

export type AdminUsersPage = {
    items: AdminUserRow[];
    total: number;
    page: number;
    pageSize: number;
};

export function fetchAdminStats() {
    return apiGet<AdminStats>("/admin/stats");
}

export function fetchAdminUsers(filter: AdminUsersFilter) {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.search) params.set("search", filter.search);
    if (filter.page) params.set("page", String(filter.page));
    if (filter.pageSize) params.set("pageSize", String(filter.pageSize));
    const qs = params.toString();
    return apiGet<AdminUsersPage>(`/admin/users${qs ? `?${qs}` : ""}`);
}

export function fetchAdminUser(id: string) {
    return apiGet<AdminUserDetail>(`/admin/users/${id}`);
}

/** Same payload as GET /habits, so deriveHabitStats reads it unchanged. */
export function fetchAdminUserHabits(id: string, year: number, month: number) {
    return apiGet<ApiHabit[]>(
        `/admin/users/${id}/habits?year=${year}&month=${month}`,
    );
}

export function updateAdminUserStatus(
    id: string,
    status: AccountStatus,
    note?: string,
) {
    return apiPatch<AdminUserRow>(`/admin/users/${id}/status`, {
        status,
        ...(note ? { note } : {}),
    });
}

export function recordAdminPayment(id: string, amount: number, note?: string) {
    return apiPost<AdminPayment>(`/admin/users/${id}/payments`, {
        amount,
        ...(note ? { note } : {}),
    });
}

export function deleteAdminUser(id: string) {
    return apiDelete<{ id: string; deleted: boolean }>(`/admin/users/${id}`);
}

// ── Admin: app releases ───────────────────────────────────────────────────
export type AppPlatform = "ANDROID" | "IOS";

export type AdminRelease = {
    id: string;
    platform: AppPlatform;
    latest: string;
    minimum: string;
    url: string;
    notes: string | null;
    updatedBy: string | null;
    createdAt: string;
    updatedAt: string;
};

export type UpsertReleaseInput = {
    latest: string;
    minimum: string;
    url: string;
    notes?: string;
};

export function fetchAdminReleases() {
    return apiGet<AdminRelease[]>("/admin/releases");
}

export function upsertAdminRelease(
    platform: AppPlatform,
    input: UpsertReleaseInput,
) {
    return apiPut<AdminRelease>(
        `/admin/releases/${platform.toLowerCase()}`,
        input,
    );
}
