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
    const res = await fetch(`${API_URL}${path}`, {
        headers: await authHeaders(false),
    });
    return handle<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: await authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    });
    return handle<T>(res);
}

/**
 * Multipart upload. Deliberately omits the JSON `Content-Type` so React
 * Native can set the `multipart/form-data` boundary itself.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: await authHeaders(false),
        body: form,
    });
    return handle<T>(res);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    });
    return handle<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        method: "DELETE",
        headers: await authHeaders(false),
    });
    return handle<T>(res);
}
