import { ApiHabit, HabitWithStats, Tod } from "./types";
import {
    DayRange,
    HeatCell,
    buildHeatmapGrid,
    dateKey,
    dayIndex,
    dayIndexOf,
} from "./date";

const TOD_VALUES: Tod[] = ["morning", "afternoon", "evening", "anytime"];

/** One month's habit list with its month-scoped logs (from `useHabitsHistory`). */
export type MonthHabits = {
    year: number;
    month: number;
    habits: ApiHabit[];
};

function fracToLevel(frac: number): number {
    if (frac <= 0) return 0;
    if (frac <= 0.25) return 1;
    if (frac <= 0.5) return 2;
    if (frac <= 0.75) return 3;
    return 4;
}

/**
 * Aggregate activity heatmap across all habits: each day's level reflects the
 * fraction of habits completed that day (mirrors the Calendar ring math).
 */
export function buildActivityCells(
    history: MonthHabits[],
    today: Date = new Date(),
): HeatCell[] {
    const counts = new Map<string, number>();
    let habitCount = 0;
    for (const m of history) {
        habitCount = Math.max(habitCount, m.habits.length);
        for (const h of m.habits)
            for (const l of h.logs) {
                const k = dateKey(l.year, l.month, l.day);
                counts.set(k, (counts.get(k) ?? 0) + 1);
            }
    }
    return buildHeatmapGrid(today, (date) => {
        if (habitCount === 0) return 0;
        const k = dateKey(
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
        );
        const c = counts.get(k) ?? 0;
        return fracToLevel(c / habitCount);
    });
}

/**
 * Single-habit heatmap: a day is fully filled (level 4) when that habit was
 * completed, empty otherwise.
 */
export function buildHabitCells(
    history: MonthHabits[],
    habitId: string,
    today: Date = new Date(),
): HeatCell[] {
    const done = new Set<string>();
    for (const m of history)
        for (const h of m.habits)
            if (h.id === habitId)
                for (const l of h.logs)
                    done.add(dateKey(l.year, l.month, l.day));
    return buildHeatmapGrid(today, (date) =>
        done.has(
            dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate()),
        )
            ? 4
            : 0,
    );
}

function normalizeTod(tod: string): Tod {
    return (TOD_VALUES as string[]).includes(tod) ? (tod as Tod) : "anytime";
}

/**
 * Derive Bloom stats (streak, best, rate, doneToday) from a single month's
 * completion logs — mirrors the web app's deriveStats so both clients agree.
 */
export function deriveHabitStats(
    h: ApiHabit,
    year: number,
    month: number,
    daysInMonth: number,
    today: Date = new Date(),
): HabitWithStats {
    const completedDays = new Set(h.logs.map((l) => l.day));
    const completed = completedDays.size;

    const isCurrentMonth =
        today.getFullYear() === year && today.getMonth() + 1 === month;
    const refDay = isCurrentMonth
        ? Math.min(today.getDate(), daysInMonth)
        : daysInMonth;
    const elapsed = isCurrentMonth ? refDay : daysInMonth;

    const doneToday = isCurrentMonth && completedDays.has(today.getDate());

    let streak = 0;
    const start = completedDays.has(refDay) ? refDay : refDay - 1;
    for (let dd = start; dd >= 1; dd--) {
        if (completedDays.has(dd)) streak++;
        else break;
    }

    let best = 0;
    let run = 0;
    for (let dd = 1; dd <= daysInMonth; dd++) {
        if (completedDays.has(dd)) {
            run++;
            if (run > best) best = run;
        } else {
            run = 0;
        }
    }

    const rate = elapsed === 0 ? 0 : Math.round((completed / elapsed) * 100);

    return {
        id: h.id,
        name: h.name,
        goal: h.goal,
        icon: h.icon || "sprout",
        tod: normalizeTod(h.tod),
        verb: h.verb ?? null,
        completed,
        left: Math.max(0, h.goal - completed),
        percent: h.goal === 0 ? 0 : Math.round((completed / h.goal) * 100),
        streak,
        best,
        rate,
        doneToday,
    };
}

export function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

/** One habit's completion over an arbitrary day range (the Insights periods). */
export type RangeHabitStats = {
    id: string;
    name: string;
    icon: string;
    tod: Tod;
    /** Distinct days completed inside the range. */
    completed: number;
    /** The rate's denominator: days the habit was expected in the range. */
    days: number;
    rate: number;
};

/**
 * Per-habit completion across a day range, aggregated from the month-scoped
 * logs `useHabitsHistory` already caches — `deriveHabitStats` sees a single
 * month, so any window wider or narrower than that comes through here.
 *
 * The denominator starts at the habit's creation day (or its earliest logged
 * day in range, when an earlier day was backfilled), never before it existed:
 * without that clamp a habit planted in July is scored against every day since
 * January and can't clear single digits in the Year view.
 */
export function deriveRangeStats(
    history: MonthHabits[],
    roster: ApiHabit[],
    range: DayRange,
): RangeHabitStats[] {
    const from = dayIndex(range.start);
    const to = dayIndex(range.end);

    const doneDays = new Map<string, Set<number>>();
    for (const m of history)
        for (const h of m.habits)
            for (const l of h.logs) {
                const day = dayIndexOf(l.year, l.month, l.day);
                if (day < from || day > to) continue;
                let done = doneDays.get(h.id);
                if (!done) doneDays.set(h.id, (done = new Set()));
                done.add(day);
            }

    return roster.map((h) => {
        const done = doneDays.get(h.id);
        const planted = dayIndex(new Date(h.createdAt));
        const expectedFrom = Math.max(
            from,
            Math.min(
                Number.isFinite(planted) ? planted : from,
                // Non-empty by construction, so Math.min has a seed.
                done ? Math.min(...done) : Infinity,
            ),
        );
        const days = Math.max(0, to - expectedFrom + 1);
        const completed = done?.size ?? 0;
        return {
            id: h.id,
            name: h.name,
            icon: h.icon || "sprout",
            tod: normalizeTod(h.tod),
            completed,
            days,
            rate: days === 0 ? 0 : Math.round((completed / days) * 100),
        };
    });
}
