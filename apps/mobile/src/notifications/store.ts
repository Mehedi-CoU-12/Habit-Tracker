import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    DEFAULT_PREFS,
    type HabitOverride,
    type ReminderPrefs,
    type TimeStr,
} from "./types";

// Local, device-scoped reminder preferences. Kept in the same shape and spirit
// as the theme prefs: an in-memory copy, a durable AsyncStorage mirror, and a
// listener set so hooks stay live. Device-local by design — the OS schedule is
// per-device — with a clean path to sync via the habit outbox later.
const KEY = "habitflow.reminders.v1";

let state: ReminderPrefs = DEFAULT_PREFS;
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
    for (const l of listeners) l();
}

/** Load once at startup; safe to call repeatedly. Returns the current prefs. */
export async function loadPrefs(): Promise<ReminderPrefs> {
    if (loaded) return state;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) state = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {
        /* corrupt payload — fall back to defaults */
    }
    loaded = true;
    notify();
    return state;
}

export function getPrefs(): ReminderPrefs {
    return state;
}

export function subscribePrefs(l: () => void): () => void {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
}

async function commit(next: ReminderPrefs): Promise<void> {
    state = next;
    loaded = true;
    notify();
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        /* best-effort persistence; in-memory state already updated */
    }
}

export function setEnabled(enabled: boolean): Promise<void> {
    return commit({ ...state, enabled });
}

export function setQuietHours(quietHours: boolean): Promise<void> {
    return commit({ ...state, quietHours });
}

/** Merge an override for one habit (shallow — pass only the fields to change). */
export function setOverride(
    habitId: string,
    patch: HabitOverride,
): Promise<void> {
    const overrides = {
        ...state.overrides,
        [habitId]: { ...state.overrides[habitId], ...patch },
    };
    return commit({ ...state, overrides });
}

/** Toggle a single preset time on/off for a habit, preserving the rest. */
export function toggleHabitTime(
    habitId: string,
    time: TimeStr,
    current: TimeStr[],
): Promise<void> {
    const has = current.includes(time);
    const next = has
        ? current.filter((t) => t !== time)
        : [...current, time].sort();
    // Never leave a habit with zero times while enabled — that reads as "on but
    // silent". Removing the last time turns the habit's reminders off instead.
    if (next.length === 0) return setOverride(habitId, { enabled: false });
    return setOverride(habitId, { enabled: true, times: next });
}

/** Live prefs for React components. */
export function useReminderPrefs(): ReminderPrefs {
    return useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
}
