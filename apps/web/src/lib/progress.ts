import { isDayComplete } from "./completion";
import { isExpectedOnDate, normalizeDays } from "./schedule";
import type { ApiHabit } from "../../app/dashboard/types";

/** Mirrors FREEZE_EVERY / MAX_FREEZES / MILESTONES in apps/api/src/habits/progress.ts. */
export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;
export const MILESTONES = [7, 30, 100] as const;

export type LiveProgress = {
    streak: number;
    longest: number;
    freezes: number;
    /** Done-days until the next freeze is earned; 0 when the bank is full. */
    toNextFreeze: number;
};

export function isoDay(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The server's snapshot plus today's own tap, or null when it is from another day. */
export function liveProgress(
    h: ApiHabit,
    today: Date,
): LiveProgress | null {
    const p = h.progress;
    if (!p || p.asOf !== isoDay(today)) return null;
    const counts =
        isExpectedOnDate(normalizeDays(h.daysOfWeek), today) &&
        isDayComplete(h, today.getDate());
    const streak = p.streak + (counts ? 1 : 0);
    const earned = counts && streak % FREEZE_EVERY === 0 ? 1 : 0;
    const freezes = Math.min(MAX_FREEZES, p.freezes + earned);
    return {
        streak,
        longest: Math.max(p.longest, streak),
        freezes,
        toNextFreeze:
            freezes >= MAX_FREEZES
                ? 0
                : FREEZE_EVERY - (streak % FREEZE_EVERY),
    };
}

/** Milestones a streak of this length has reached. */
export function reachedMilestones(days: number): number[] {
    return MILESTONES.filter((m) => days >= m);
}

/** The next milestone above `days`, or null past the last one. */
export function nextMilestone(days: number): number | null {
    return MILESTONES.find((m) => m > days) ?? null;
}

/** Plant growth stage 0–5; the plant blooms at each milestone. */
export function plantStage(streak: number): number {
    if (streak <= 0) return 0;
    if (streak < 3) return 1;
    if (streak < 7) return 2;
    if (streak < 30) return 3;
    if (streak < 100) return 4;
    return 5;
}

/** Next milestone to celebrate (recorded in `seen`); a habit's first sighting is recorded silently. */
export function claimMilestone(
    seen: Record<string, number>,
    habitId: string,
    streak: number,
): number | null {
    const top = reachedMilestones(streak).at(-1) ?? 0;
    const prev = seen[habitId];
    if (prev === undefined) {
        seen[habitId] = top;
        return null;
    }
    if (top <= prev) return null;
    seen[habitId] = top;
    return top;
}
