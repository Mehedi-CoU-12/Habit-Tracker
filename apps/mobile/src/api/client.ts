import { Platform } from "react-native";
import { KEYS, storage } from "../lib/storage";

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

type RefreshResult =
    | { status: "ok"; token: string }
    | { status: "dead" }
    | { status: "offline" };

let refreshInFlight: Promise<RefreshResult> | null = null;

function attemptRefresh(): Promise<RefreshResult> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
        const refreshToken = await storage.get(KEYS.refreshToken);
        if (!refreshToken) return { status: "offline" };
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
            throw new ApiError("Network error during token refresh", 0);
        }
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
    const text = await res.text();
    if (!text) return null as T;
    return JSON.parse(text) as T;
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

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
    return handle<T>(
        await send(
            path,
            { method: "PUT", body: body ? JSON.stringify(body) : undefined },
            true,
        ),
    );
}

export async function apiDelete<T>(path: string): Promise<T> {
    return handle<T>(await send(path, { method: "DELETE" }, false));
}
