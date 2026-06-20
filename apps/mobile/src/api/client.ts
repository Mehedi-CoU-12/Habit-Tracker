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
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function authHeaders(json = true): Promise<Record<string, string>> {
    const token = await storage.get(KEYS.token);
    return {
        ...(json ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let message = "Request failed";
        try {
            const body = await res.json();
            message = (body as { message?: string }).message ?? message;
        } catch {
            /* non-json error body */
        }
        throw new ApiError(message, res.status);
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
