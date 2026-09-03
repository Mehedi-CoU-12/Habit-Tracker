/**
 * Heatmap grid model. Turns the month-scoped logs `useHabitsHistory` caches
 * into a laid-out grid of day cells plus a summary for the visible window.
 *
 * Three periods, three layouts — a week is a labelled strip of 7, a month is a
 * real calendar block, a year is one row per month. All three emit the same
 * `HeatDay` shape so `components/Heatmap` renders them with one pass of
 * geometry.
 *
 * The year deliberately isn't the GitHub week-column grid: 53 columns across a
 * phone leaves ~4px cells, too small to read or tap. Twelve rows of 31 day
 * cells fits the same width at ~9px, and month boundaries land on rows instead
 * of a cramped top axis.
 */

import {
    DayRange,
    addDays,
    dayIndex,
    dayIndexOf,
    endOfMonth,
    monthShort,
    monthsSpanned,
    startOfDay,
} from "./date";
import { MonthHabits } from "./deriveStats";
import {
    amountOn,
    completedLogs,
    skippedDaysOf,
    targetOf,
} from "./completion";
import {
    expectedDaysBetween,
    isExpectedOn,
    normalizeDays,
    previousExpected,
} from "./schedule";

/**
 * The bits of a habit the grid math needs beyond its logs. Passed as one bag
 * rather than four positional args, and `ApiHabit` satisfies it structurally,
 * so callers hand over the habit itself.
 */
export type HabitSchedule = {
    createdAt?: string;
    /** Weekdays the habit is due on, 0 = Sunday. Empty/absent = daily. */
    daysOfWeek?: number[];
    /** Days after this are dormant: the habit was retired, not missed. */
    archivedAt?: string | null;
};

export const HEAT_PERIODS = ["Week", "Month", "Year"] as const;
export type HeatPeriod = (typeof HEAT_PERIODS)[number];

export type HeatLayout = "row" | "calendar" | "months";

export type HeatDay = {
    /** Days since the epoch — the identity all the streak math runs on. */
    index: number;
    col: number;
    row: number;
    /** 0 = nothing recorded, 1–4 = increasing intensity. */
    level: number;
    done: boolean;
    /** Past today: nothing could have happened yet. */
    future: boolean;
    /** Before the habit existed, or grid padding outside the period. */
    dormant: boolean;
    /** Forgiven by a spent skip — drawn distinctly, never as a completion. */
    skipped?: boolean;
    today: boolean;
    day: number;
    month: number;
    year: number;
    weekday: number;
    /** Status clause for the tap readout; defaults to done/missed. */
    detail?: string;
};

export type HeatGrid = {
    layout: HeatLayout;
    cols: number;
    rows: number;
    days: HeatDay[];
    /** Row → month abbreviation, for the year grid's left axis. */
    rowLabels: { row: number; label: string }[];
};

export type HeatSummary = {
    /** Completions inside the window (habit-days, when aggregating). */
    completed: number;
    /** The rate's denominator: days the habit(s) were expected in the window. */
    expected: number;
    rate: number;
    /** Longest run of completed days inside the window. */
    best: number;
    /** Days where every habit alive that day was completed (activity only). */
    perfect?: number;
};

export type HeatResult = {
    grid: HeatGrid;
    summary: HeatSummary;
    range: DayRange;
};

/**
 * The inclusive day span a period covers, always ending today. Month and Year
 * are calendar aligned to-date so they keep matching the Insights hero; Week is
 * the trailing 7 days rather than Sunday-anchored, which would collapse to a
 * single day every Sunday.
 */
export function heatRange(period: HeatPeriod, today: Date): DayRange {
    const end = startOfDay(today);
    switch (period) {
        case "Month":
            return {
                start: new Date(end.getFullYear(), end.getMonth(), 1),
                end,
            };
        case "Year":
            return { start: new Date(end.getFullYear(), 0, 1), end };
        default:
            return { start: addDays(end, -6), end };
    }
}

/**
 * First day the grid *draws*, which can run ahead of the range: Month and Year
 * both render whole months, so their blocks open on the 1st.
 */
function gridStart(period: HeatPeriod, range: DayRange): Date {
    if (period === "Month")
        return new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    if (period === "Year") return range.start;
    return range.start;
}

/** Last day drawn — through the end of the current month for both block
 * layouts, so the remainder of the month shows as unfilled future days. */
function gridEnd(period: HeatPeriod, range: DayRange): Date {
    if (period === "Month" || period === "Year") return endOfMonth(range.end);
    return range.end;
}

/**
 * Trailing months of history a period's grid needs — the fetch width for
 * `useHabitsHistory`. Wider than the range itself, since the drawn grid can
 * reach back into the previous month (or, for Year, the previous December).
 */
export function monthsForHeat(period: HeatPeriod, today: Date): number {
    const range = heatRange(period, today);
    return monthsSpanned({ start: gridStart(period, range), end: range.end });
}

/**
 * Day indices belonging to months whose logs have actually arrived. Days
 * outside it render dormant rather than missed: a month still in flight has no
 * completions to report, and painting it as a solid run of misses is a lie that
 * flashes on every cold load of the Year view.
 */
function loadedDays(history: MonthHabits[]): Set<number> {
    const known = new Set<number>();
    for (const m of history) {
        if (m.loaded === false) continue;
        const first = dayIndexOf(m.year, m.month, 1);
        const length = new Date(m.year, m.month, 0).getDate();
        for (let i = 0; i < length; i++) known.add(first + i);
    }
    return known;
}

/** Per-day verdict the two builders feed into the shared layout pass. */
type Resolver = (index: number) => {
    level: number;
    done: boolean;
    /** True when the day predates anything being tracked. */
    dormant: boolean;
    /** Forgiven by a spent skip. */
    skipped?: boolean;
    detail?: string;
};

function buildGrid(
    period: HeatPeriod,
    range: DayRange,
    today: Date,
    resolve: Resolver,
): HeatGrid {
    const first = gridStart(period, range);
    const last = gridEnd(period, range);
    const firstIdx = dayIndex(first);
    const total = dayIndex(last) - firstIdx + 1;
    const todayIdx = dayIndex(today);
    const rangeStartIdx = dayIndex(range.start);
    // Weekday the month block opens on — the calendar layout's row offset.
    const monthOffset = first.getDay();
    const firstMonth = first.getMonth();

    const layout: HeatLayout =
        period === "Week" ? "row" : period === "Month" ? "calendar" : "months";
    const cols = period === "Year" ? 31 : 7;
    const rows =
        period === "Week"
            ? 1
            : period === "Month"
              ? Math.ceil((monthOffset + total) / 7)
              : last.getMonth() - firstMonth + 1;

    const days: HeatDay[] = [];
    const rowLabels: { row: number; label: string }[] = [];

    for (let i = 0; i < total; i++) {
        const date = addDays(first, i);
        const index = firstIdx + i;
        const weekday = date.getDay();
        const col =
            period === "Week"
                ? i
                : period === "Month"
                  ? weekday
                  : date.getDate() - 1;
        const row =
            period === "Week"
                ? 0
                : period === "Month"
                  ? ((monthOffset + i) / 7) | 0
                  : date.getMonth() - firstMonth;

        const future = index > todayIdx;
        const r = future
            ? { level: 0, done: false, dormant: false }
            : resolve(index);

        days.push({
            index,
            col,
            row,
            level: r.level,
            done: r.done,
            future,
            dormant: r.dormant || index < rangeStartIdx,
            today: index === todayIdx,
            skipped: r.skipped,
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            weekday,
            detail: r.detail,
        });

        if (period === "Year" && date.getDate() === 1)
            rowLabels.push({ row, label: monthShort[date.getMonth()] });
    }

    return { layout, cols, rows, days, rowLabels };
}

// ── Per-habit ───────────────────────────────────────────────────────────────

type HabitDays = {
    done: Set<number>;
    /**
     * Day index → length of the completed run *ending* on that day, with
     * forgiven days bridged. This is the number the streak reads.
     */
    depth: Map<number, number>;
    /**
     * The same, unforgiving: a skipped day breaks the run. `best` reads this,
     * because a record should be the high-water mark of actual work.
     */
    rawDepth: Map<number, number>;
    /** Ascending completed day indices. */
    sorted: number[];
    /** Day index → fraction of the target logged, for days short of it. */
    partial: Map<number, number>;
    /** Day indices forgiven by a spent skip. */
    skipped: Set<number>;
    /**
     * The previous day that counts against a run, walking back through both
     * rest days and forgiven days. For a daily habit with nothing forgiven
     * this is just `from`.
     */
    prevCounting: (from: number) => number;
};

/**
 * Every day this habit was logged, across all loaded months, with each day's
 * run depth. Depth is what shades the grid: an isolated day reads lighter than
 * the fourth day of a streak, so consistency shows up as solid blocks.
 *
 * A run chains along the days the habit was *due*, not raw calendar days — for
 * a Mon/Wed/Fri habit, Wednesday continues Monday's run and the Tuesday in
 * between is not a gap.
 */
function collectHabitDays(
    history: MonthHabits[],
    habitId: string,
    daysOfWeek: number[] = [],
): HabitDays {
    const done = new Set<number>();
    const partial = new Map<number, number>();
    const skipped = new Set<number>();
    for (const m of history)
        for (const h of m.habits)
            if (h.id === habitId) {
                for (const day of skippedDaysOf(h))
                    skipped.add(dayIndexOf(m.year, m.month, day));
                for (const l of completedLogs(h))
                    done.add(dayIndexOf(l.year, l.month, l.day));
                // Days with progress that fell short — shaded, but never
                // counted as completions (see D5 in the plan).
                const target = targetOf(h);
                for (const l of h.logs) {
                    const index = dayIndexOf(l.year, l.month, l.day);
                    if (done.has(index)) continue;
                    const got = amountOn(h, l.day);
                    if (got > 0) partial.set(index, got / target);
                }
            }

    const sorted = [...done].sort((a, b) => a - b);

    /**
     * A forgiven day is transparent to a run, exactly like a rest day —
     * that equivalence is what streak insurance buys. Terminates because
     * previousExpected strictly decreases and `skipped` is finite.
     */
    const prevCounting = (from: number): number => {
        let p = previousExpected(daysOfWeek, from);
        while (skipped.has(p)) p = previousExpected(daysOfWeek, p - 1);
        return p;
    };

    const depth = new Map<number, number>();
    const rawDepth = new Map<number, number>();
    // Ascending, so the previous due day's depth is already resolved. For a
    // daily habit previousExpected(d - 1) is just d - 1.
    for (const d of sorted) {
        depth.set(d, (depth.get(prevCounting(d - 1)) ?? 0) + 1);
        const raw = previousExpected(daysOfWeek, d - 1);
        rawDepth.set(d, (rawDepth.get(raw) ?? 0) + 1);
    }
    return { done, depth, rawDepth, sorted, partial, skipped, prevCounting };
}

function depthToLevel(depth: number): number {
    if (depth <= 0) return 0;
    if (depth === 1) return 2;
    if (depth <= 3) return 3;
    return 4;
}

/**
 * The first day a habit can fairly be judged on: when it was planted, pulled
 * back if an earlier day was backfilled. Days before it render dormant rather
 * than missed — you can't skip a habit that didn't exist yet.
 */
function plantedIndex(
    createdAt: string | undefined,
    sorted: number[],
    fallback: number,
): number {
    const planted = createdAt ? dayIndex(new Date(createdAt)) : NaN;
    const earliestLog = sorted.length ? sorted[0] : Infinity;
    const candidate = Math.min(
        Number.isFinite(planted) ? planted : Infinity,
        earliestLog,
    );
    return Number.isFinite(candidate) ? candidate : fallback;
}

export function buildHabitHeatmap(
    history: MonthHabits[],
    habitId: string,
    period: HeatPeriod,
    today: Date,
    habit?: HabitSchedule,
): HeatResult {
    const daysOfWeek = normalizeDays(habit?.daysOfWeek);
    const { done, depth, sorted, partial, skipped } = collectHabitDays(
        history,
        habitId,
        daysOfWeek,
    );
    const known = loadedDays(history);
    const todayIdx = dayIndex(today);
    const planted = plantedIndex(habit?.createdAt, sorted, todayIdx);
    // After archiving the habit was retired, so those days are dormant rather
    // than a growing wall of misses.
    const retired = habit?.archivedAt
        ? dayIndex(new Date(habit.archivedAt))
        : Infinity;
    const range = heatRange(period, today);

    // A day the habit wasn't due on is dormant too — same reasoning as days
    // before it was planted: you can't skip something that wasn't asked of you.
    const due = (index: number) => isExpectedOn(daysOfWeek, index);

    const grid = buildGrid(period, range, today, (index) => {
        const d = depth.get(index) ?? 0;
        const off = index < planted || index > retired || !due(index);
        const part = partial.get(index);
        // A forgiven day gets its own treatment rather than a level: level 1
        // is already the partial shade, and a skip is not partial progress.
        const isSkipped = skipped.has(index) && d === 0;
        return {
            // Level 1 is the partial shade — lighter than any completed day,
            // so progress shows without reading as a finished one.
            level: d > 0 ? depthToLevel(d) : part ? 1 : 0,
            done: d > 0,
            dormant: off || !known.has(index),
            skipped: isSkipped,
            detail: isSkipped
                ? "skipped · streak kept"
                : d > 1
                  ? `done · ${d} day run`
                  : part
                    ? `${Math.round(part * 100)}% of target`
                    : undefined,
        };
    });

    // The rate scores only loaded, due days — an in-flight month must not drag
    // the denominator down before its logs land, and a rest day was never owed.
    const from = Math.max(dayIndex(range.start), planted);
    const to = Math.min(dayIndex(range.end), todayIdx, retired);
    let completed = 0;
    let expected = 0;
    let run = 0;
    let best = 0;
    for (let d = from; d <= to; d++) {
        if (!known.has(d)) {
            run = 0;
            continue;
        }
        if (!due(d)) continue; // neither owed nor a break in the run
        expected++;
        if (done.has(d)) {
            completed++;
            run++;
            if (run > best) best = run;
        } else {
            run = 0;
        }
    }

    return {
        grid,
        range,
        summary: {
            completed,
            expected,
            best,
            rate: expected === 0 ? 0 : Math.round((completed / expected) * 100),
        },
    };
}

/**
 * Streak, best run and overall rate across every month currently loaded — the
 * habit detail header. `deriveHabitStats` only ever sees one month, so a run
 * spanning the 1st of the month resets there; this doesn't.
 */
export function habitHistoryStats(
    history: MonthHabits[],
    habitId: string,
    today: Date,
    habit?: HabitSchedule,
): { streak: number; best: number; completed: number; rate: number } {
    const daysOfWeek = normalizeDays(habit?.daysOfWeek);
    const { depth, rawDepth, sorted, prevCounting } = collectHabitDays(
        history,
        habitId,
        daysOfWeek,
    );
    const todayIdx = dayIndex(today);
    // Today still being open shouldn't read as a broken streak — fall back to
    // the run that ended on the previous day that counts (yesterday, for a
    // daily habit with nothing forgiven).
    const streak =
        depth.get(todayIdx) ?? depth.get(prevCounting(todayIdx - 1)) ?? 0;
    // `best` reads the unforgiving chain: a record is the high-water mark of
    // actual work, so a skip must not extend it.
    const best = sorted.reduce((m, d) => Math.max(m, rawDepth.get(d) ?? 0), 0);

    const planted = plantedIndex(habit?.createdAt, sorted, todayIdx);
    const retired = habit?.archivedAt
        ? dayIndex(new Date(habit.archivedAt))
        : Infinity;
    const to = Math.min(todayIdx, retired);
    const completed = sorted.filter((d) => d >= planted && d <= to).length;
    const days = expectedDaysBetween(daysOfWeek, planted, to);
    const doneOnDue = sorted.filter(
        (d) => d >= planted && d <= to && isExpectedOn(daysOfWeek, d),
    ).length;

    return {
        streak,
        best,
        completed,
        rate: days === 0 ? 0 : Math.round((doneOnDue / days) * 100),
    };
}

// ── All habits ──────────────────────────────────────────────────────────────

function fracToLevel(frac: number): number {
    if (frac <= 0) return 0;
    if (frac <= 0.25) return 1;
    if (frac <= 0.5) return 2;
    if (frac <= 0.75) return 3;
    return 4;
}

/** One habit's window and schedule, for counting what was owed on a day. */
type ActiveHabit = {
    planted: number;
    /** Day it was archived; days after this are no longer owed. */
    retired: number;
    daysOfWeek: number[];
};

/**
 * Aggregate activity: a day's level is the share of habits completed out of the
 * habits that were *due that day* — not out of today's roster. Dividing by the
 * roster's high-water mark (what this used to do) washes out early months, when
 * three-of-three completed scored the same as three-of-ten. Weekday schedules
 * and archiving narrow it further: a rest day and a retired habit are not owed.
 */
export function buildActivityHeatmap(
    history: MonthHabits[],
    period: HeatPeriod,
    today: Date,
): HeatResult {
    const counts = new Map<number, number>();
    const habits = new Map<string, ActiveHabit>();

    for (const m of history)
        for (const h of m.habits) {
            let earliest = Infinity;
            for (const l of h.logs) {
                const d = dayIndexOf(l.year, l.month, l.day);
                if (d < earliest) earliest = d;
            }
            for (const l of completedLogs(h)) {
                const d = dayIndexOf(l.year, l.month, l.day);
                counts.set(d, (counts.get(d) ?? 0) + 1);
            }
            const created = dayIndex(new Date(h.createdAt));
            const at = Math.min(
                Number.isFinite(created) ? created : Infinity,
                earliest,
            );
            if (!Number.isFinite(at)) continue;
            const prev = habits.get(h.id);
            // The same habit appears once per loaded month; keep the earliest
            // planting seen and the newest schedule/archive state.
            habits.set(h.id, {
                planted: prev === undefined ? at : Math.min(prev.planted, at),
                retired: h.archivedAt
                    ? dayIndex(new Date(h.archivedAt))
                    : Infinity,
                daysOfWeek: normalizeDays(h.daysOfWeek),
            });
        }

    const roster = [...habits.values()];
    const firstEver = roster.reduce(
        (min, h) => Math.min(min, h.planted),
        Infinity,
    );
    // O(roster) per day rather than the old binary search, because "was this
    // owed today" now depends on each habit's own weekday schedule.
    const activeOn = (index: number) => {
        let n = 0;
        for (const h of roster) {
            if (index < h.planted || index > h.retired) continue;
            if (!isExpectedOn(h.daysOfWeek, index)) continue;
            n++;
        }
        return n;
    };
    const known = loadedDays(history);

    const range = heatRange(period, today);
    const grid = buildGrid(period, range, today, (index) => {
        const active = activeOn(index);
        const c = counts.get(index) ?? 0;
        return {
            level: active === 0 ? 0 : fracToLevel(c / active),
            done: c > 0,
            dormant: index < firstEver || !known.has(index),
            detail:
                active === 0
                    ? undefined
                    : `${c} of ${active} habit${active === 1 ? "" : "s"}`,
        };
    });

    const todayIdx = dayIndex(today);
    const from = Math.max(dayIndex(range.start), firstEver);
    const to = Math.min(dayIndex(range.end), todayIdx);
    let completed = 0;
    let expected = 0;
    let perfect = 0;
    let run = 0;
    let best = 0;
    for (let d = from; d <= to; d++) {
        if (!known.has(d)) {
            run = 0;
            continue;
        }
        const active = activeOn(d);
        const c = counts.get(d) ?? 0;
        completed += c;
        expected += active;
        if (active > 0 && c >= active) perfect++;
        if (c > 0) {
            run++;
            if (run > best) best = run;
        } else {
            run = 0;
        }
    }

    return {
        grid,
        range,
        summary: {
            completed,
            expected,
            perfect,
            best,
            rate: expected === 0 ? 0 : Math.round((completed / expected) * 100),
        },
    };
}
