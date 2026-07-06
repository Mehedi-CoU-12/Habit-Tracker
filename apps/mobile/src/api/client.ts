import { Platform } from "react-native";
import { KEYS, storage } from "../lib/storage";

/**
 * Base URL for the shared NestJS API (same one the web app uses).
 *
 * `localhost` does not reach the dev machine from a device/emulator, so:
 *  - set EXPO_PUBLIC_API_URL to your machine's LAN IP (e.g. http://192.168.1.5:3333)
 *    when testing on a physical device, OR
 *  - the Android emulator reaches the host via 10.0.2.2.
 */
export const API_URL =
    process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === "android"
        ? "http://10.0.2.2:3333"
        : "http://localhost:3333");

export class ApiError extends Error {
    status: number;
    /** Machine-readable discriminator, e.g. ACCOUNT_PENDING / ACCOUNT_SUSPENDED. */
    code?: string;
    constructor(message: string, status: number, code?: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/**
 * Central auth events, registered by AuthProvider. Most screens swallow query
 * errors silently, so the gate cannot depend on per-screen handling — these
 * fire from `handle()` for every response instead.
 */
type GateEvents = {
    /** 401 — the token is dead (expired, or the account was deleted). */
    onUnauthorized?: () => void;
    /** 403 ACCOUNT_* — the account was gated (e.g. suspended) mid-session. */
    onAccountGated?: () => void;
};
const gateEvents: GateEvents = {};

export function registerGateEvents(events: GateEvents) {
    Object.assign(gateEvents, events);
}

// Identifies this app to the API's ClientGuard. The mobile app sends no
// Origin header, so this is how the API recognises it as legitimate (rather
// than an arbitrary tool like Postman). Not a hard secret — it ships in the
// app bundle; the JWT remains the real authorization.
const APP_CLIENT_KEY = process.env.EXPO_PUBLIC_APP_CLIENT_KEY ?? "";

async function authHeaders(json = true): Promise<Record<string, string>> {
    const token = await storage.get(KEYS.token);
    return {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...(APP_CLIENT_KEY ? { "x-app-client": APP_CLIENT_KEY } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

// ── Silent refresh ──────────────────────────────────────────────────────
// The access token is short-lived (~15m); a longer-lived refresh token mints
// a new one so the user isn't signed out mid-session. A single in-flight
// refresh is shared, so several requests 401-ing at once trigger exactly one
// /auth/refresh.
//
// The result is a discriminated outcome, NOT a nullable token, because "the
// refresh failed" has two very different meanings that must not be conflated:
//   - "dead":    the server rejected the refresh token (expired/revoked) — the
//                session is genuinely over and the user must sign in again.
//   - "offline": we could not reach the server (network/transport error) — the
//                session is still valid; fail this one request and retry later.
// Treating an "offline" failure as "dead" would sign the user out on a flaky
// connection (and, via signOut()'s server logout, revoke a still-valid token).
type RefreshResult =
    | { status: "ok"; token: string }
    | { status: "dead" }
    | { status: "offline" };

let refreshInFlight: Promise<RefreshResult> | null = null;

function attemptRefresh(): Promise<RefreshResult> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
        const refreshToken = await storage.get(KEYS.refreshToken);
        if (!refreshToken) return { status: "dead" };
        try {
            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(APP_CLIENT_KEY
                        ? { "x-app-client": APP_CLIENT_KEY }
                        : {}),
                },
                body: JSON.stringify({ refreshToken }),
            });
            if (res.status === 401 || res.status === 403) {
                // Server rejected the refresh token (expired or revoked) — drop
                // it; the caller signs out.
                await storage.remove(KEYS.refreshToken);
                return { status: "dead" };
            }
            if (!res.ok) {
                // 5xx / unexpected — treat as transient; keep tokens and retry.
                return { status: "offline" };
            }
            const data = (await res.json()) as {
                accessToken: string;
                refreshToken: string;
            };
            await storage.set(KEYS.token, data.accessToken);
            if (data.refreshToken)
                await storage.set(KEYS.refreshToken, data.refreshToken);
            return { status: "ok", token: data.accessToken };
        } catch {
            // Network error — keep tokens so a later request can retry.
            return { status: "offline" };
        } finally {
            refreshInFlight = null;
        }
    })();
    return refreshInFlight;
}

/**
 * fetch() with the auth headers attached, retried once through a silent token
 * refresh on a 401. authHeaders() re-reads the (now-refreshed) token, so the
 * retry carries the new bearer.
 */
async function send(
    path: string,
    init: RequestInit,
    json: boolean,
    isRetry = false,
): Promise<Response> {
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: await authHeaders(json),
    });
    if (res.status === 401 && !isRetry) {
        const refreshed = await attemptRefresh();
        if (refreshed.status === "ok") return send(path, init, json, true);
        if (refreshed.status === "offline") {
            // Could not reach the server to refresh — do NOT let this 401 reach
            // handle(), which would sign the user out. Surface a network-style
            // error the query can retry once connectivity returns.
            throw new ApiError("Network error during token refresh", 0);
        }
        // "dead": fall through and return the 401 so handle() signs out.
    }
    return res;
}

async function handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let message = "Request failed";
        let code: string | undefined;
        try {
            const body = await res.json();
            message = (body as { message?: string }).message ?? message;
            code = (body as { code?: string }).code;
        } catch {
            /* non-json error body */
        }
        if (res.status === 401) {
            gateEvents.onUnauthorized?.();
        } else if (
            res.status === 403 &&
            (code === "ACCOUNT_PENDING" || code === "ACCOUNT_SUSPENDED")
        ) {
            gateEvents.onAccountGated?.();
        }
        throw new ApiError(message, res.status, code);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
    return handle<T>(await send(path, {}, false));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
    return handle<T>(
        await send(
            path,
            { method: "POST", body: body ? JSON.stringify(body) : undefined },
            true,
        ),
    );
}

/**
 * Multipart upload. Deliberately omits the JSON `Content-Type` so React
 * Native can set the `multipart/form-data` boundary itself.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
    return handle<T>(await send(path, { method: "POST", body: form }, false));
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
    return handle<T>(
        await send(
            path,
            { method: "PATCH", body: body ? JSON.stringify(body) : undefined },
            true,
        ),
    );
}

export async function apiDelete<T>(path: string): Promise<T> {
    return handle<T>(await send(path, { method: "DELETE" }, false));
}
