import { ApiHabit, HabitWithStats, Tod } from "./types";
import { DayRange, dayIndex, dayIndexOf } from "./date";
import {
    expectedDaysBetween,
    isExpectedOn,
    isExpectedOnDate,
    normalizeDays,
} from "./schedule";

const TOD_VALUES: Tod[] = ["morning", "afternoon", "evening", "anytime"];

/** One month's habit list with its month-scoped logs (from `useHabitsHistory`). */
export type MonthHabits = {
    year: number;
    month: number;
    habits: ApiHabit[];
    /**
     * False while this month's logs are still in flight. The heatmap needs it
     * to tell "no completions" apart from "not fetched yet" — absent the flag
     * an unresolved month paints as a solid run of misses.
     */
    loaded?: boolean;
};

function normalizeTod(tod: string): Tod {
    return (TOD_VALUES as string[]).includes(tod) ? (tod as Tod) : "anytime";
}

/**
 * Derive Bloom stats (streak, best, rate, doneToday) from a single month's
 * completion logs — mirrors the web app's deriveStats so both clients agree.
 *
 * Every day-counting loop consults the habit's weekday schedule: a day the
 * habit isn't due on neither breaks a streak nor lands in the rate's
 * denominator. A habit with no schedule is due daily, which is what makes the
 * numbers identical to the pre-scheduling behaviour.
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
    const daysOfWeek = normalizeDays(h.daysOfWeek);

    const isCurrentMonth =
        today.getFullYear() === year && today.getMonth() + 1 === month;
    const refDay = isCurrentMonth
        ? Math.min(today.getDate(), daysInMonth)
        : daysInMonth;
    const elapsed = isCurrentMonth ? refDay : daysInMonth;

    const doneToday = isCurrentMonth && completedDays.has(today.getDate());

    // Weekday of the 1st, so a day-of-month maps to a weekday without
    // building a Date per iteration.
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const dueOn = (dom: number) =>
        daysOfWeek.length === 0 ||
        daysOfWeek.includes((firstWeekday + dom - 1) % 7);

    // Walk back from today. A rest day is skipped — it can neither extend the
    // streak nor break it; only a missed *due* day breaks it.
    let streak = 0;
    let from = refDay;
    // Today still being open shouldn't read as a broken streak.
    if (dueOn(refDay) && !completedDays.has(refDay)) from = refDay - 1;
    for (let dd = from; dd >= 1; dd--) {
        if (!dueOn(dd)) continue;
        if (completedDays.has(dd)) streak++;
        else break;
    }

    let best = 0;
    let run = 0;
    for (let dd = 1; dd <= daysInMonth; dd++) {
        if (!dueOn(dd)) continue;
        if (completedDays.has(dd)) {
            run++;
            if (run > best) best = run;
        } else {
            run = 0;
        }
    }

    // The rate is scored over due days only, numerator included: a completion
    // backfilled onto a rest day is a bonus, not something that can push the
    // rate past 100%.
    let dueElapsed = 0;
    let doneOnDue = 0;
    for (let dd = 1; dd <= elapsed; dd++) {
        if (!dueOn(dd)) continue;
        dueElapsed++;
        if (completedDays.has(dd)) doneOnDue++;
    }
    const rate =
        dueElapsed === 0 ? 0 : Math.round((doneOnDue / dueElapsed) * 100);

    return {
        id: h.id,
        name: h.name,
        goal: h.goal,
        icon: h.icon || "sprout",
        tod: normalizeTod(h.tod),
        verb: h.verb ?? null,
        daysOfWeek,
        archivedAt: h.archivedAt ?? null,
        scheduledToday: isExpectedOnDate(daysOfWeek, today),
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
 * January and can't clear single digits in the Year view. It then counts only
 * the days the habit was actually due, so a three-times-a-week habit isn't
 * scored out of seven.
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
        const daysOfWeek = normalizeDays(h.daysOfWeek);
        const days = expectedDaysBetween(daysOfWeek, expectedFrom, to);
        const completed = done?.size ?? 0;
        // Scored on due days only, matching `days` — see deriveHabitStats.
        const doneOnDue = done
            ? [...done].filter((d) => isExpectedOn(daysOfWeek, d)).length
            : 0;
        return {
            id: h.id,
            name: h.name,
            icon: h.icon || "sprout",
            tod: normalizeTod(h.tod),
            completed,
            days,
            rate: days === 0 ? 0 : Math.round((doneOnDue / days) * 100),
        };
    });
}
