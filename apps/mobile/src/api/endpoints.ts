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
        // New signups start PENDING — the auth screens route on this.
        status: AccountStatus;
    };
};

export function login(email: string, password: string) {
    return apiPost<AuthResult>("/auth/login", { email, password });
}

export function signup(name: string, email: string, password: string) {
    return apiPost<AuthResult>("/auth/signup", { name, email, password });
}

/** Revoke all sessions server-side (bumps tokenVersion). Idempotent. */
export function logout(refreshToken: string) {
    return apiPost<{ success: boolean }>("/auth/logout", { refreshToken });
}

/**
 * Trade the one-time code from the Google sign-in deep link for tokens +
 * user (see AuthProvider.signInWithGoogle for the full flow).
 */
export function googleExchange(code: string) {
    return apiPost<AuthResult>("/auth/google/exchange", { code });
}

export function fetchMe() {
    return apiGet<UserProfile>("/users/me");
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
