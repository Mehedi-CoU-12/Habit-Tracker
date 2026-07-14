import type { Tod } from "../lib/types";

// Stable prefixes so the reconcile pass can tell its own scheduled
// notifications apart from anything else and diff desired-vs-actual by id.
// `rem__` notifications are fully managed by syncReminders(); `remsnooze__`
// ones are one-shot, self-expiring, and deliberately left out of reconcile.
export const REMINDER_PREFIX = "rem__";
export const SNOOZE_PREFIX = "remsnooze__";
export const CATEGORY = "habit-reminder";
export const CHANNEL = "reminders";

// How many days ahead we keep scheduled. Topped up on every foreground, so the
// daily repetition is really "always keep the next N days laid out ahead".
export const HORIZON_DAYS = 5;
// iOS silently drops pending local notifications past 64 per app. Coalescing by
// time-slot keeps us well under this, but we still cap with headroom.
export const IOS_BUDGET = 56;

/** A HH:MM (24h, local wall-clock) reminder time. */
export type TimeStr = string;

/** Per-habit override of the tod-derived default. Absent fields fall back. */
export type HabitOverride = {
    enabled?: boolean;
    times?: TimeStr[];
    /** Custom notification body (e.g. "Did you go to the office today?"). */
    message?: string;
};

export type ReminderPrefs = {
    /** Master switch — reminders are opt-in, off until the user enables them. */
    enabled: boolean;
    /** When true, nothing fires between 22:00 and 07:00 local. */
    quietHours: boolean;
    /** Sparse map of per-habit overrides, keyed by habit id. */
    overrides: Record<string, HabitOverride>;
};

export const DEFAULT_PREFS: ReminderPrefs = {
    enabled: false,
    quietHours: true,
    overrides: {},
};

/** tod bucket → sensible default reminder time when a habit has no override. */
// Kept aligned with PRESET_TIMES so a habit's default always maps to a chip.
export const TOD_DEFAULT_TIME: Record<Tod, TimeStr> = {
    morning: "08:00",
    afternoon: "13:00",
    evening: "19:00",
    anytime: "19:00",
};

/** The preset times offered as chips in settings (multi-select per habit). */
export const PRESET_TIMES: { label: string; time: TimeStr }[] = [
    { label: "Morning", time: "08:00" },
    { label: "Midday", time: "13:00" },
    { label: "Evening", time: "19:00" },
    { label: "Night", time: "21:00" },
];

/** "08:00" → "8:00 AM" for display. */
export function formatTime12h(t: TimeStr): string {
    const [h, m] = t.split(":").map(Number);
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** The effective reminder for a habit: its override, or the tod default. */
export function effectiveReminder(
    habitId: string,
    tod: Tod,
    prefs: ReminderPrefs,
): { enabled: boolean; times: TimeStr[] } {
    const o = prefs.overrides[habitId] ?? {};
    return {
        enabled: o.enabled ?? true, // habits are reminded by default once the master is on
        times: o.times && o.times.length ? o.times : [TOD_DEFAULT_TIME[tod]],
    };
}
