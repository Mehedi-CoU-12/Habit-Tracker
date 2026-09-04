/**
 * The native-readable mirror of app state that the home-screen widgets draw
 * from.
 *
 * A widget renders in the launcher's process, with no JS runtime running: none
 * of the react-query cache is reachable from it. So the real feature is not
 * "draw a grid", it is maintaining a second, native-readable copy of state and
 * keeping it current forever. Everything here follows from that.
 *
 * Two rules hold it together:
 *
 *  1. **The payload carries presentation, not domain state.** A level per day,
 *     a fraction per habit — never a raw log. Mirroring logs would mean
 *     porting `completion.ts` into Kotlin, which is the shared maths
 *     duplicated into a third language, and the two JS copies have already
 *     drifted once.
 *
 *  2. **There is exactly one write point.** Rather than calling this from each
 *     of the seven mutation hooks — where the eighth would be forgotten — it
 *     subscribes to the query cache. Any state change that reaches the cache
 *     reaches the widget.
 */

import { AppState, Platform } from "react-native";
import { HabitflowWidgetModule } from "../../modules/habitflow-widget";
import { queryClient } from "../api/queryClient";
import { habitsKey } from "../api/hooks";
import type { ApiHabit, UserProfile } from "../lib/types";
import { amountOn, isDayComplete, targetOf } from "../lib/completion";
import { daysInMonth, deriveHabitStats } from "../lib/deriveStats";
import { isExpectedOn, isExpectedOnDate, normalizeDays } from "../lib/schedule";
import { dayIndex, dayIndexOf } from "../lib/date";
import { ACCENTS, type AccentKey } from "../theme/tokens";

/** Days of history the large widget shows: five weeks of seven. */
const HISTORY_DAYS = 35;

/**
 * Payload version. Bumped whenever the shape changes; the Kotlin reader
 * refuses anything it does not know rather than half-drawing it, so an app
 * downgrade shows the signed-out state instead of garbage.
 */
const VERSION = 1;

type MirrorHabit = {
    id: string;
    name: string;
    /** 0..1 of today's target. */
    progress: number;
    done: boolean;
    streak: number;
    /** "3 / 8 cups" for a quantified habit, "" for a binary one. */
    detail: string;
};

type MirrorPayload = {
    v: number;
    signedIn: boolean;
    updatedAt: number;
    /** Local calendar day this was computed for, "YYYY-MM-DD". */
    day: string;
    accent: string;
    dark: boolean;
    habits: MirrorHabit[];
    doneToday: number;
    dueToday: number;
    /** Trailing HISTORY_DAYS activity levels, oldest first, 0..4. */
    levels: number[];
};

const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
    ).padStart(2, "0")}`;

// ── Theme ───────────────────────────────────────────────────────────────────
// The widget must follow the *app's* accent and dark-mode choice, not the
// phone's: a user on a light phone with HabitFlow set to dark expects a dark
// widget. Those prefs live in React state (ThemeProvider), which this module
// cannot read, so the provider pushes them here instead.

let theme: { dark: boolean; accent: AccentKey } = {
    dark: false,
    accent: "coral",
};

/** Called by ThemeProvider whenever the accent or dark-mode choice changes. */
export function setWidgetTheme(next: { dark: boolean; accent: AccentKey }) {
    if (next.dark === theme.dark && next.accent === theme.accent) return;
    theme = next;
    schedule();
}

// ── Payload ─────────────────────────────────────────────────────────────────

/** Share of a day's habits completed → the heatmap's 0–4 shade. */
function fracToLevel(frac: number): number {
    if (frac <= 0) return 0;
    if (frac <= 0.25) return 1;
    if (frac <= 0.5) return 2;
    if (frac <= 0.75) return 3;
    return 4;
}

/**
 * Every month of habits the cache currently holds. The widget's five-week
 * window can straddle a month boundary, so it reads them all rather than just
 * the current month's.
 */
function cachedMonths(): { year: number; month: number; habits: ApiHabit[] }[] {
    return queryClient
        .getQueryCache()
        .findAll({ queryKey: ["habits"] })
        .flatMap((q) => {
            const [, year, month] = q.queryKey as [string, number, number];
            const habits = q.state.data as ApiHabit[] | undefined;
            if (!habits || typeof year !== "number") return [];
            return [{ year, month, habits }];
        });
}

/**
 * The trailing window's per-day levels, computed the way the in-app activity
 * heatmap does: a day's shade is the share of the habits *due that day* that
 * were completed, not a share of today's roster. Dividing by the roster's
 * high-water mark would wash out early months, where three-of-three scored the
 * same as three-of-ten.
 */
function levelsFor(
    months: { year: number; month: number; habits: ApiHabit[] }[],
    now: Date,
): number[] {
    const todayIdx = dayIndex(now);
    const from = todayIdx - (HISTORY_DAYS - 1);

    const done = new Map<number, number>();
    const rosters = new Map<
        string,
        { daysOfWeek: number[]; retired: number }
    >();

    for (const m of months) {
        for (const h of m.habits) {
            for (const l of h.logs) {
                const index = dayIndexOf(l.year, l.month, l.day);
                if (index < from || index > todayIdx) continue;
                if ((l.amount ?? 1) < targetOf(h)) continue;
                done.set(index, (done.get(index) ?? 0) + 1);
            }
            rosters.set(h.id, {
                daysOfWeek: normalizeDays(h.daysOfWeek),
                retired: h.archivedAt
                    ? dayIndex(new Date(h.archivedAt))
                    : Infinity,
            });
        }
    }

    const roster = [...rosters.values()];
    const levels: number[] = [];
    for (let index = from; index <= todayIdx; index++) {
        let active = 0;
        for (const h of roster) {
            if (index > h.retired) continue;
            if (!isExpectedOn(h.daysOfWeek, index)) continue;
            active++;
        }
        const c = done.get(index) ?? 0;
        levels.push(active === 0 ? 0 : fracToLevel(c / active));
    }
    return levels;
}

/** Build the payload from whatever the cache currently holds. */
export function buildPayload(now = new Date()): MirrorPayload {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dom = now.getDate();
    const dim = daysInMonth(year, month);

    const thisMonth =
        queryClient.getQueryData<ApiHabit[]>(habitsKey(year, month)) ?? [];

    const due = thisMonth.filter(
        (h) =>
            !h.archivedAt && isExpectedOnDate(normalizeDays(h.daysOfWeek), now),
    );

    const habits: MirrorHabit[] = due.map((h) => {
        const target = targetOf(h);
        const amount = amountOn(h, dom);
        return {
            id: h.id,
            name: h.name,
            progress: Math.min(1, amount / target),
            done: isDayComplete(h, dom),
            // Through deriveHabitStats rather than a local walk, so the number
            // on the widget is the number on the Today row — including the
            // forgiven days streak insurance bridges.
            streak: deriveHabitStats(h, year, month, dim, now).streak,
            detail:
                h.target != null
                    ? `${amount} / ${target}${h.unit ? ` ${h.unit}` : ""}`
                    : "",
        };
    });

    // Signed-out is a real state the widget draws, not an absence: the cache
    // is cleared on sign-out, and "no habits" must not read as "you have
    // nothing planted".
    const signedIn = queryClient.getQueryData<UserProfile>(["me"]) != null;

    return {
        v: VERSION,
        signedIn,
        updatedAt: Date.now(),
        day: dayKey(now),
        accent: (ACCENTS[theme.accent] ?? ACCENTS.coral).accent,
        dark: theme.dark,
        habits,
        doneToday: habits.filter((h) => h.done).length,
        dueToday: habits.length,
        levels: levelsFor(cachedMonths(), now),
    };
}

// ── The bridge ──────────────────────────────────────────────────────────────

const native = HabitflowWidgetModule;

/** Whether this build can talk to a widget at all. */
export function widgetsAvailable(): boolean {
    return Platform.OS === "android" && native != null;
}

/** Whether the launcher currently has a HabitFlow widget placed. */
export function widgetPlaced(): boolean {
    if (!widgetsAvailable()) return false;
    try {
        return native!.hasWidgets();
    } catch {
        return false;
    }
}

async function write(payload: MirrorPayload | null): Promise<void> {
    if (!widgetsAvailable()) return;
    try {
        await native!.setMirror(
            payload === null ? null : JSON.stringify(payload),
        );
    } catch {
        /* the widget is a nicety — never let it break a write path */
    }
}

/** Recompute from the cache and push. Cheap, and safe to over-call. */
export function syncWidget(): void {
    if (!widgetsAvailable()) return;
    void write(buildPayload());
}

/**
 * Blank the widget. Called on sign-out and on account deletion: a widget still
 * showing a deleted account's habits is a privacy bug, not a stale cache, and
 * it is the one widget failure that leaks data rather than just being wrong.
 */
export function clearWidget(): Promise<void> {
    return write(null);
}

// ── Triggers ────────────────────────────────────────────────────────────────

let started = false;
let pending: ReturnType<typeof setTimeout> | null = null;
let lastDay = "";

/**
 * Coalesce the burst of cache events one user action produces (the optimistic
 * write, the drain, then the reconcile) into a single native write.
 */
function schedule(): void {
    if (!widgetsAvailable() || pending) return;
    pending = setTimeout(() => {
        pending = null;
        syncWidget();
    }, 250);
}

/**
 * Wire the mirror's triggers once: every habits-cache change, and every
 * foreground that lands on a new day — so a widget left overnight rolls over
 * to the new day's roster without the user opening anything. Theme changes
 * come in through setWidgetTheme.
 */
export function startWidgetMirror(): void {
    if (started || !widgetsAvailable()) return;
    started = true;

    queryClient.getQueryCache().subscribe((event) => {
        const key = event.query.queryKey;
        if (Array.isArray(key) && key[0] === "habits") schedule();
    });

    AppState.addEventListener("change", (s) => {
        if (s !== "active") return;
        const today = dayKey(new Date());
        if (today === lastDay) return;
        lastDay = today;
        schedule();
    });

    lastDay = dayKey(new Date());
    schedule();
}
