import { ApiHabit, HabitWithStats, Tod } from "./types";

const TOD_VALUES: Tod[] = ["morning", "afternoon", "evening", "anytime"];

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
