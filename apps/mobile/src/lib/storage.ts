import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

type Storage = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
};

const nativeStorage: Storage = {
    async get(key: string): Promise<string | null> {
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await SecureStore.getItemAsync(key);
            } catch {
                if (attempt === 2) return null;
                await new Promise((r) => setTimeout(r, 60));
            }
        }
        return null;
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

const webStorage: Storage = {
    async get(key: string): Promise<string | null> {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null; // storage blocked (e.g. private mode) — treat as absent
        }
    },
    async set(key: string, value: string): Promise<void> {
        try {
            window.localStorage.setItem(key, value);
        } catch {
            // ignore write failures — prefs are best-effort
        }
    },
    async remove(key: string): Promise<void> {
        try {
            window.localStorage.removeItem(key);
        } catch {
            // ignore
        }
    },
};

export const storage: Storage =
    Platform.OS === "web" ? webStorage : nativeStorage;

export const KEYS = {
    token: "habitflow.token",
    refreshToken: "habitflow.refreshToken",
    prefs: "habitflow.prefs",
    onboarded: "habitflow.onboarded",
    sound: "habitflow.sound",
    focus: "habitflow.focus",
    /** Version whose update nudge the user dismissed — re-nags on the next one. */
    updateDismissed: "habitflow.updateDismissed",
} as const;
