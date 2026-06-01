import { ApiHabit, HabitWithStats, Tod } from "../../app/dashboard/types";

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
 */
export function deriveHabitStats(
    h: ApiHabit,
    year: number,
    month: number,
    daysInMonth: number,
): HabitWithStats {
    const completedDays = new Set(h.logs.map((l) => l.day));
    const completed = completedDays.size;

    const now = new Date();
    const isCurrentMonth =
        now.getFullYear() === year && now.getMonth() + 1 === month;
    const refDay = isCurrentMonth
        ? Math.min(now.getDate(), daysInMonth)
        : daysInMonth;
    const elapsed = isCurrentMonth ? refDay : daysInMonth;

    const doneToday = isCurrentMonth && completedDays.has(now.getDate());

    // current streak: consecutive completed days counting back from refDay.
    // when the reference day itself isn't done yet, start from the day before
    // so an ongoing streak isn't reported as broken before the day is over.
    let streak = 0;
    const start = completedDays.has(refDay) ? refDay : refDay - 1;
    for (let d = start; d >= 1; d--) {
        if (completedDays.has(d)) streak++;
        else break;
    }

    // best run within the month
    let best = 0;
    let run = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        if (completedDays.has(d)) {
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
