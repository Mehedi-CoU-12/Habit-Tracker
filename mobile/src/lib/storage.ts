import * as SecureStore from "expo-secure-store";

/**
 * Thin wrapper over expo-secure-store. Used for the auth token, UI prefs,
 * and the onboarding flag. Values are small JSON-or-string blobs.
 */
export const storage = {
    async get(key: string): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(key);
        } catch {
            return null;
        }
    },
    async set(key: string, value: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch {
            // ignore write failures (e.g. value too large) — prefs are best-effort
        }
    },
    async remove(key: string): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch {
            // ignore
        }
    },
};

export const KEYS = {
    token: "habitflow.token",
    prefs: "habitflow.prefs",
    onboarded: "habitflow.onboarded",
} as const;
