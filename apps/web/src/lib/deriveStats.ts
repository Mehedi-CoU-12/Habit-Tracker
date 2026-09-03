import { ApiHabit, HabitWithStats, Tod } from "../../app/dashboard/types";
import { isExpectedOnDate, normalizeDays } from "./schedule";
import {
    amountOn,
    completedDaysOf,
    skipsLeft,
    skippedDaysOf,
} from "./completion";

const TOD_VALUES: Tod[] = ["morning", "afternoon", "evening", "anytime"];

function normalizeTod(tod: string): Tod {
    return (TOD_VALUES as string[]).includes(tod) ? (tod as Tod) : "anytime";
}

/**
 * Derive Bloom-style stats (streak, best, rate, doneToday) for a habit from
 * the completion logs of a single month.
 *
 * Note: the API returns logs scoped to one month, so streaks are measured
 * within that month, ending at "today" (when viewing the current month) or at
 * the last day of the month otherwise.
 *
 * Kept in step with apps/mobile/src/lib/deriveStats.ts — both clients must
 * report the same numbers for the same habit.
 */
export function deriveHabitStats(
    h: ApiHabit,
    year: number,
    month: number,
    daysInMonth: number,
    today: Date = new Date(),
): HabitWithStats {
    const completedDays = completedDaysOf(h);
    const skippedDays = skippedDaysOf(h);
    const completed = completedDays.size;
    const daysOfWeek = normalizeDays(h.daysOfWeek);

    const now = today;
    const isCurrentMonth =
        now.getFullYear() === year && now.getMonth() + 1 === month;
    const refDay = isCurrentMonth
        ? Math.min(now.getDate(), daysInMonth)
        : daysInMonth;
    const elapsed = isCurrentMonth ? refDay : daysInMonth;

    const doneToday = isCurrentMonth && completedDays.has(now.getDate());

    /** Weekday of the 1st, so day-of-month maps to a weekday without a Date. */
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const dueOn = (dom: number) =>
        daysOfWeek.length === 0 ||
        daysOfWeek.includes((firstWeekday + dom - 1) % 7);

    // current streak: consecutive completed DUE days counting back from refDay.
    // a rest day is skipped — only a missed due day breaks the run. when the
    // reference day itself isn't done yet, start from the day before so an
    // ongoing streak isn't reported as broken before the day is over.
    // a forgiven day (streak insurance) behaves exactly like a rest day.
    let streak = 0;
    let from = refDay;
    if (dueOn(refDay) && !completedDays.has(refDay)) from = refDay - 1;
    for (let d = from; d >= 1; d--) {
        if (!dueOn(d)) continue;
        if (skippedDays.has(d)) continue;
        if (completedDays.has(d)) streak++;
        else break;
    }

    // best run of due days within the month. deliberately ignores skips: it is
    // the high-water mark of actual work, and records should be unforgiving
    // even when daily life is not.
    let best = 0;
    let run = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        if (!dueOn(d)) continue;
        if (completedDays.has(d)) {
            run++;
            if (run > best) best = run;
        } else {
            run = 0;
        }
    }

    // scored over due days only, numerator included, so a completion
    // backfilled onto a rest day can't push the rate past 100%. a skip touches
    // neither side — it bridges the chain, it is not a completion, and the
    // rate must read the same before and after one is spent.
    let dueElapsed = 0;
    let doneOnDue = 0;
    for (let d = 1; d <= elapsed; d++) {
        if (!dueOn(d)) continue;
        dueElapsed++;
        if (completedDays.has(d)) doneOnDue++;
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
        target: h.target ?? null,
        unit: h.unit ?? null,
        step: h.step && h.step > 0 ? h.step : 1,
        fillFromFocus: h.fillFromFocus ?? false,
        skippedDays: [...skippedDays].sort((a, b) => a - b),
        skipsLeft: skipsLeft(h),
        todayAmount: isCurrentMonth ? amountOn(h, now.getDate()) : 0,
        daysOfWeek,
        archivedAt: h.archivedAt ?? null,
        scheduledToday: isExpectedOnDate(daysOfWeek, now),
        completed,
        left: Math.max(0, h.goal - completed),
        percent: h.goal === 0 ? 0 : Math.round((completed / h.goal) * 100),
        streak,
        best,
        rate,
        doneToday,
    };
}
