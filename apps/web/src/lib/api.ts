import { ApiHabit } from "../../app/dashboard/types";

export type UserRole = "USER" | "ADMIN";
export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export type UserProfile = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: UserRole;
    status: AccountStatus;
    createdAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

// Identifies this app to the API's ClientGuard so requests aren't rejected as
// non-app traffic. Not a secret in any real sense (it ships in the browser
// bundle) — the JWT is the real authorization; this just blocks casual
// Postman/script calls.
const APP_CLIENT_KEY = process.env.NEXT_PUBLIC_APP_CLIENT_KEY ?? "";

// ── Token storage ───────────────────────────────────────────────────────
// Both tokens live in localStorage (a cross-site web↔API topology rules out
// httpOnly cookies — see the CSP note in next.config.js). The access token is
// short-lived (~15m); the refresh token silently mints a new one so the user
// isn't bounced to login every few minutes.
const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

function getAccessToken(): string | null {
    return typeof window !== "undefined"
        ? localStorage.getItem(ACCESS_KEY)
        : null;
}

function getRefreshToken(): string | null {
    return typeof window !== "undefined"
        ? localStorage.getItem(REFRESH_KEY)
        : null;
}

/** Persist the token pair after login/signup/OAuth or a refresh. */
export function setTokens(accessToken: string, refreshToken?: string | null) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

/** Drop both tokens (dead session / sign-out). */
export function clearTokens() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
}

function clientHeader(): Record<string, string> {
    return APP_CLIENT_KEY ? { "x-app-client": APP_CLIENT_KEY } : {};
}

// ── Silent refresh ──────────────────────────────────────────────────────
// A single in-flight refresh is shared across all callers: several requests
// 401-ing at once trigger exactly one /auth/refresh, then all retry with the
// fresh token. Resolves to the new access token, or null if refresh failed
// (in which case the tokens have been cleared and the caller should give up).
let refreshInFlight: Promise<string | null> | null = null;

function refreshTokens(): Promise<string | null> {
    if (refreshInFlight) return refreshInFlight;
    const refreshToken = getRefreshToken();
    if (!refreshToken) return Promise.resolve(null);

    refreshInFlight = (async () => {
        try {
            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: "POST",
                headers: {
                    ...clientHeader(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ refreshToken }),
            });
            if (!res.ok) {
                // Refresh token is dead (expired or revoked) — nothing left to
                // do but sign in again.
                clearTokens();
                return null;
            }
            const data = (await res.json()) as {
                accessToken: string;
                refreshToken: string;
            };
            setTokens(data.accessToken, data.refreshToken);
            return data.accessToken;
        } catch {
            // Network error — leave tokens in place so the next request can retry.
            return null;
        } finally {
            refreshInFlight = null;
        }
    })();
    return refreshInFlight;
}

/**
 * fetch() wrapper that attaches the client key + bearer token and, on a 401,
 * transparently refreshes the access token and retries the request once.
 */
async function authedFetch(
    path: string,
    init: RequestInit = {},
    isRetry = false,
): Promise<Response> {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
            ...clientHeader(),
            ...(init.headers as Record<string, string> | undefined),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (res.status === 401 && !isRetry && getRefreshToken()) {
        const newToken = await refreshTokens();
        if (newToken) return authedFetch(path, init, true);
    }
    return res;
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 401) {
        // Reached here only after a refresh attempt already failed (or there was
        // no refresh token): the session is truly dead.
        if (typeof window !== "undefined") {
            const isAuthPage = ["/", "/login", "/signup"].includes(
                window.location.pathname,
            );
            if (!isAuthPage) {
                clearTokens();
                window.location.href = "/login";
            }
        }
        throw new Error("Unauthorized");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const { code } = body as { code?: string };
        // Account-gate 403s: the account exists but isn't ACTIVE — route to
        // the waiting screen. Deliberately not the 401 path: an expired
        // session (even a pending one) still belongs on /login.
        if (
            res.status === 403 &&
            (code === "ACCOUNT_PENDING" || code === "ACCOUNT_SUSPENDED") &&
            typeof window !== "undefined" &&
            window.location.pathname !== "/pending"
        ) {
            window.location.href = "/pending";
        }
        const raw = (body as { message?: string | string[] }).message;
        // NestJS ValidationPipe returns `message` as an array of strings.
        const message = Array.isArray(raw) ? raw.join(", ") : raw;
        throw new Error(message ?? "Request failed");
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    // A handler returning null (GET /app/version with nothing published) sends
    // 200 with an empty body, which JSON.parse would throw on.
    if (!text) return null as T;
    return JSON.parse(text) as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Sign out of all sessions. Best-effort server revocation (bumps tokenVersion
 * so every device's tokens die), then always clears local tokens.
 */
export async function logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: "POST",
                headers: { ...clientHeader(), ...JSON_HEADERS },
                body: JSON.stringify({ refreshToken }),
            });
        } catch {
            /* offline — local clear below still signs the user out here */
        }
    }
    clearTokens();
}

export async function fetchMe(): Promise<UserProfile> {
    const res = await authedFetch(`/users/me`);
    return handleResponse<UserProfile>(res);
}

export async function updateProfile(data: {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
}): Promise<UserProfile> {
    const res = await authedFetch(`/users/me`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(data),
    });
    return handleResponse<UserProfile>(res);
}

export async function uploadAvatar(file: File): Promise<UserProfile> {
    const form = new FormData();
    form.append("avatar", file);
    // No Content-Type header — the browser sets the multipart boundary.
    const res = await authedFetch(`/users/me/avatar`, {
        method: "POST",
        body: form,
    });
    return handleResponse<UserProfile>(res);
}

export async function fetchHabits(
    year: number,
    month: number,
): Promise<ApiHabit[]> {
    const res = await authedFetch(`/habits?year=${year}&month=${month}`);
    return handleResponse<ApiHabit[]>(res);
}

export type CreateHabitInput = {
    name: string;
    goal: number;
    icon?: string;
    tod?: string;
    verb?: string;
    /** Daily target amount; null clears it and reverts the habit to binary. */
    target?: number | null;
    unit?: string | null;
    step?: number;
};

export async function createHabit(input: CreateHabitInput): Promise<ApiHabit> {
    const res = await authedFetch(`/habits`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
    });
    return handleResponse<ApiHabit>(res);
}

export type UpdateHabitInput = Partial<CreateHabitInput>;

export async function updateHabit(
    id: string,
    input: UpdateHabitInput,
): Promise<ApiHabit> {
    const res = await authedFetch(`/habits/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
    });
    return handleResponse<ApiHabit>(res);
}

export async function deleteHabit(id: string): Promise<void> {
    const res = await authedFetch(`/habits/${id}`, { method: "DELETE" });
    return handleResponse<void>(res);
}

export async function applyTemplate(
    templateId: string,
): Promise<{ created: number }> {
    const res = await authedFetch(`/habits/apply-template`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ templateId }),
    });
    return handleResponse<{ created: number }>(res);
}

export async function toggleLog(
    habitId: string,
    year: number,
    month: number,
    day: number,
): Promise<{ completed: boolean }> {
    const res = await authedFetch(`/habits/logs/toggle`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ habitId, year, month, day }),
    });
    return handleResponse<{ completed: boolean }>(res);
}

/** Absolute amount write for one (habit, date). Zero clears the day. */
export async function setLogAmount(
    habitId: string,
    year: number,
    month: number,
    day: number,
    amount: number,
): Promise<{ amount: number; completed: boolean }> {
    const res = await authedFetch(`/habits/logs/amount`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify({ habitId, year, month, day, amount }),
    });
    return handleResponse<{ amount: number; completed: boolean }>(res);
}

// ── Focus sessions ──────────────────────────────────────────────────────

export type FocusDayTotals = { sessions: number; minutes: number };

export type FocusStats = {
    today: FocusDayTotals;
    week: FocusDayTotals;
    allTime: FocusDayTotals & { days: number };
    streak: number;
    best: FocusDayTotals;
    days: ({ date: string } & FocusDayTotals)[];
    byHabit: ({
        habitId: string | null;
        name: string;
        icon: string | null;
    } & FocusDayTotals)[];
};

export type RecordFocusSessionInput = {
    habitId?: string;
    minutes: number;
    year: number;
    month: number;
    day: number;
};

export async function recordFocusSession(
    input: RecordFocusSessionInput,
): Promise<{ id: string }> {
    const res = await authedFetch(`/focus/sessions`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
    });
    return handleResponse<{ id: string }>(res);
}

/** year/month/day = the client's local today, so day math follows the user. */
export async function fetchFocusStats(
    year: number,
    month: number,
    day: number,
): Promise<FocusStats> {
    const res = await authedFetch(
        `/focus/stats?year=${year}&month=${month}&day=${day}`,
    );
    return handleResponse<FocusStats>(res);
}

// ── Admin (all endpoints require role ADMIN — enforced by the API) ──────

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
    lastActiveAt: string | null;
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

export async function fetchAdminStats(): Promise<AdminStats> {
    const res = await authedFetch(`/admin/stats`);
    return handleResponse<AdminStats>(res);
}

export async function fetchAdminUsers(
    filter: AdminUsersFilter,
): Promise<AdminUsersPage> {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.search) params.set("search", filter.search);
    if (filter.page) params.set("page", String(filter.page));
    if (filter.pageSize) params.set("pageSize", String(filter.pageSize));
    const qs = params.toString();
    const res = await authedFetch(`/admin/users${qs ? `?${qs}` : ""}`);
    return handleResponse<AdminUsersPage>(res);
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
    const res = await authedFetch(`/admin/users/${id}`);
    return handleResponse<AdminUserDetail>(res);
}

// Same payload shape as GET /habits, so the admin progress view reuses the
// dashboard's deriveStats + chart components unchanged.
export async function fetchAdminUserHabits(
    id: string,
    year: number,
    month: number,
): Promise<ApiHabit[]> {
    const res = await authedFetch(
        `/admin/users/${id}/habits?year=${year}&month=${month}`,
    );
    return handleResponse<ApiHabit[]>(res);
}

export async function updateAdminUserStatus(
    id: string,
    status: AccountStatus,
    note?: string,
): Promise<AdminUserRow> {
    const res = await authedFetch(`/admin/users/${id}/status`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
    });
    return handleResponse<AdminUserRow>(res);
}

export async function recordAdminPayment(
    id: string,
    amount: number,
    note?: string,
): Promise<AdminPayment> {
    const res = await authedFetch(`/admin/users/${id}/payments`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ amount, ...(note ? { note } : {}) }),
    });
    return handleResponse<AdminPayment>(res);
}

export async function deleteAdminUser(
    id: string,
): Promise<{ id: string; deleted: boolean }> {
    const res = await authedFetch(`/admin/users/${id}`, { method: "DELETE" });
    return handleResponse<{ id: string; deleted: boolean }>(res);
}

// ── App releases ────────────────────────────────────────────────────────
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

export async function fetchAdminReleases(): Promise<AdminRelease[]> {
    const res = await authedFetch(`/admin/releases`);
    return handleResponse<AdminRelease[]>(res);
}

export async function upsertAdminRelease(
    platform: AppPlatform,
    input: UpsertReleaseInput,
): Promise<AdminRelease> {
    const res = await authedFetch(`/admin/releases/${platform.toLowerCase()}`, {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
    });
    return handleResponse<AdminRelease>(res);
}
