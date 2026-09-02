import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { queryClient } from "../api/queryClient";
import type { ApiHabit, Tod } from "../lib/types";
import { isExpectedOnDate, normalizeDays } from "../lib/schedule";
import { hasPermission } from "./permissions";
import { getPrefs, loadPrefs } from "./store";
import {
    CATEGORY,
    HORIZON_DAYS,
    IOS_BUDGET,
    PRESET_TIMES,
    REMINDER_PREFIX,
    SNOOZE_PREFIX,
    effectiveReminder,
    type ReminderPrefs,
    type TimeStr,
} from "./types";

const TOD_VALUES: Tod[] = ["morning", "afternoon", "evening", "anytime"];
function normalizeTod(tod: string): Tod {
    return (TOD_VALUES as string[]).includes(tod) ? (tod as Tod) : "anytime";
}

type HabitLite = {
    id: string;
    name: string;
    tod: Tod;
    doneToday: boolean;
    /** Weekdays it is due on, 0 = Sunday. Empty = daily. */
    daysOfWeek: number[];
};

// The habits query is keyed ["habits", year, month] (see api/hooks habitsKey);
// inlined here to keep this module free of a cycle back into the React hooks.
function habitsKey(year: number, month: number) {
    return ["habits", year, month] as const;
}

/** Read the current month's habits from the cache + whether each is done today. */
function readHabits(now: Date): HabitLite[] {
    const list =
        queryClient.getQueryData<ApiHabit[]>(
            habitsKey(now.getFullYear(), now.getMonth() + 1),
        ) ?? [];
    const today = now.getDate();
    return (
        list
            // An archived habit is retired: no nudges for something the user
            // has explicitly put down.
            .filter((h) => !h.archivedAt)
            .map((h) => ({
                id: h.id,
                name: h.name,
                tod: normalizeTod(h.tod),
                doneToday: h.logs.some((l) => l.day === today),
                daysOfWeek: normalizeDays(h.daysOfWeek),
            }))
    );
}

function pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}
function parseTime(t: TimeStr): { h: number; m: number } {
    const [h, m] = t.split(":").map(Number);
    return { h: h || 0, m: m || 0 };
}
function dateAt(base: Date, dayOffset: number, time: TimeStr): Date {
    const { h, m } = parseTime(time);
    return new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate() + dayOffset,
        h,
        m,
        0,
        0,
    );
}
function dayKey(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function inQuietHours(time: TimeStr): boolean {
    const { h } = parseTime(time);
    return h >= 22 || h < 7;
}
function idFor(dKey: string, time: TimeStr): string {
    return `${REMINDER_PREFIX}${dKey}__${time}`;
}

/** Human-facing title/body for a slot, coalescing multiple habits into one. */
// A habit's custom message only shows when it's alone in its slot — a coalesced
// summary can't speak in one habit's voice, so it falls back to the name list.
function renderCopy(items: { name: string; message?: string }[]): {
    title: string;
    body: string;
} {
    if (items.length === 1) {
        return {
            title: items[0].name,
            body:
                items[0].message?.trim() || "You haven't done this yet today.",
        };
    }
    return {
        title: `${items.length} habits still pending`,
        body: items.map((i) => i.name).join(" · "),
    };
}

type Desired = Map<
    string,
    {
        date: Date;
        title: string;
        body: string;
        data: { habitIds: string[]; slot: TimeStr };
    }
>;

/**
 * The desired set of pending notifications over the horizon. Coalesces every
 * habit sharing a (day, time) into a single summary, skips habits not due on
 * that weekday, skips completed habits for today, skips times already passed
 * today and quiet hours, and enforces the iOS budget by keeping the earliest
 * occurrences.
 */
export function computeDesired(
    habits: HabitLite[],
    prefs: ReminderPrefs,
    now: Date,
): Desired {
    const desired: Desired = new Map();

    for (let off = 0; off <= HORIZON_DAYS; off++) {
        const items = new Map<TimeStr, { name: string; message?: string }[]>();
        const ids = new Map<TimeStr, string[]>();

        // The local date this offset lands on, for the weekday check below.
        const dayDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + off,
        );

        for (const h of habits) {
            const eff = effectiveReminder(h.id, h.tod, prefs);
            if (!eff.enabled) continue;
            // Nothing is owed on a rest day, so nothing should be nudged.
            if (!isExpectedOnDate(h.daysOfWeek, dayDate)) continue;
            // Today, only remind about what's NOT done yet; future days are all
            // pending (a fresh day starts with nothing completed).
            if (off === 0 && h.doneToday) continue;
            for (const time of eff.times) {
                if (!items.has(time)) {
                    items.set(time, []);
                    ids.set(time, []);
                }
                items.get(time)!.push({
                    name: h.name,
                    message: prefs.overrides[h.id]?.message,
                });
                ids.get(time)!.push(h.id);
            }
        }

        for (const [time, list] of items) {
            const fireAt = dateAt(now, off, time);
            if (fireAt.getTime() <= now.getTime()) continue; // never the past
            if (prefs.quietHours && inQuietHours(time)) continue;
            const { title, body } = renderCopy(list);
            desired.set(idFor(dayKey(fireAt), time), {
                date: fireAt,
                title,
                body,
                data: { habitIds: ids.get(time)!, slot: time },
            });
        }
    }

    if (desired.size <= IOS_BUDGET) return desired;
    // Over budget: keep the soonest, drop the farthest-future.
    const kept = [...desired.entries()]
        .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
        .slice(0, IOS_BUDGET);
    return new Map(kept);
}

/**
 * Idempotently make the OS's pending set equal the desired set. Safe to call
 * from anywhere, any number of times (foreground, after a write, on settings
 * change) — it diffs and only touches what changed. Mirrors the sync reconcile.
 */
export async function syncReminders(): Promise<void> {
    if (Platform.OS === "web") return; // scheduling unsupported on web
    const prefs = await loadPrefs();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    // We only manage REMINDER_PREFIX ids; snoozes are one-shot and left alone.
    const ours = scheduled.filter((n) =>
        n.identifier.startsWith(REMINDER_PREFIX),
    );

    const cancelAll = () =>
        Promise.all(
            ours.map((n) =>
                Notifications.cancelScheduledNotificationAsync(n.identifier),
            ),
        );

    if (!prefs.enabled || !(await hasPermission())) {
        await cancelAll();
        return;
    }

    const now = new Date();
    const desired = computeDesired(readHabits(now), prefs, now);

    // Cancel anything no longer wanted.
    for (const n of ours) {
        if (!desired.has(n.identifier)) {
            await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
    }
    // Schedule anything missing, or reschedule if the summary content changed
    // (e.g. one of three habits got completed → count drops to two).
    for (const [id, d] of desired) {
        const existing = ours.find((n) => n.identifier === id);
        if (
            existing &&
            existing.content.title === d.title &&
            existing.content.body === d.body
        ) {
            continue;
        }
        if (existing) {
            await Notifications.cancelScheduledNotificationAsync(id);
        }
        await Notifications.scheduleNotificationAsync({
            identifier: id,
            content: {
                title: d.title,
                body: d.body,
                data: d.data,
                categoryIdentifier: CATEGORY,
                sound: "default",
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: d.date,
            },
        });
    }
}

/**
 * Re-fire a reminder for the still-pending habits in `habitIds` after `minutes`.
 * Uses the SNOOZE_PREFIX so the reconcile pass won't immediately cancel it.
 */
export async function scheduleSnooze(
    habitIds: string[],
    slot: TimeStr,
    minutes: number,
): Promise<void> {
    if (habitIds.length === 0) return;
    const overrides = getPrefs().overrides;
    const pending = readHabits(new Date())
        .filter((h) => habitIds.includes(h.id) && !h.doneToday)
        .map((h) => ({ name: h.name, message: overrides[h.id]?.message }));
    if (pending.length === 0) return; // all done — nothing to snooze

    const date = new Date(Date.now() + minutes * 60 * 1000);
    const { title, body } = renderCopy(pending);
    await Notifications.scheduleNotificationAsync({
        identifier: `${SNOOZE_PREFIX}${slot}__${date.getTime()}`,
        content: {
            title,
            body,
            data: { habitIds, slot },
            categoryIdentifier: CATEGORY,
            sound: "default",
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
        },
    });
}

/** Optimistically mark a habit done in the cache (for the "Mark done" action). */
export function markDoneInCache(habitId: string, now: Date): void {
    const key = habitsKey(now.getFullYear(), now.getMonth() + 1);
    const day = now.getDate();
    queryClient.setQueryData<ApiHabit[]>(key, (old) =>
        old?.map((h) => {
            if (h.id !== habitId || h.logs.some((l) => l.day === day)) return h;
            return {
                ...h,
                logs: [
                    ...h.logs,
                    {
                        id: `local-${habitId}-${day}`,
                        habitId,
                        userId: h.userId,
                        year: now.getFullYear(),
                        month: now.getMonth() + 1,
                        day,
                        createdAt: now.toISOString(),
                    },
                ],
            };
        }),
    );
}

// Re-export for callers that only want the imperative surface.
export { getPrefs, PRESET_TIMES };
