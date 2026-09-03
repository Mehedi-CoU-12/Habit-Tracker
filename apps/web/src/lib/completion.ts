/** The one place that decides whether a habit's day counts as done. */

type Log = { day: number; amount?: number };
type Quantified = { target?: number | null };
type WithLogs<L extends Log> = Quantified & { logs: L[] };
type Skip = { day: number };
type WithSkips = { skips?: Skip[] };


/** How much a log records. A row with no amount predates quantities: one. */
function amountOf(l: Log): number {
    return l.amount ?? 1;
}

/** The daily amount a habit must reach. A binary habit needs one. */
export function targetOf(h: Quantified): number {
    return h.target ?? 1;
}

/** Whether the habit tracks an amount rather than a plain done/not-done. */
export function isQuantified(h: Quantified): boolean {
    return h.target != null;
}

/** The logs that count as their day being complete. */
export function completedLogs<L extends Log>(h: WithLogs<L>): L[] {
    const target = targetOf(h);
    return h.logs.filter((l) => amountOf(l) >= target);
}

/** Days of the month the habit completed. */
export function completedDaysOf<L extends Log>(h: WithLogs<L>): Set<number> {
    return new Set(completedLogs(h).map((l) => l.day));
}

/** Whether the habit completed one given day of the month. */
export function isDayComplete<L extends Log>(
    h: WithLogs<L>,
    day: number,
): boolean {
    const target = targetOf(h);
    return h.logs.some((l) => l.day === day && amountOf(l) >= target);
}

/** How much is logged on one day, 0 when nothing is. */
export function amountOn<L extends Log>(h: WithLogs<L>, day: number): number {
    const log = h.logs.find((l) => l.day === day);
    return log ? amountOf(log) : 0;
}

/** The fraction of a day's target that is done, clamped to 0..1. */
export function progressOn<L extends Log>(
    h: WithLogs<L>,
    day: number,
): number {
    return Math.min(1, amountOn(h, day) / targetOf(h));
}

// ── Streak insurance ────────────────────────────────────────────────────────

/**
 * Skips one habit may spend per calendar month. Mirrors SKIPS_PER_MONTH in
 * apps/api/src/habits/habits.service.ts, which is the enforcing copy — this
 * one only decides what the UI offers.
 */
export const SKIPS_PER_MONTH = 1;

/**
 * Days of the month the habit has a skip spent on.
 *
 * A skip makes a missed due day behave like a rest day, retroactively: it
 * bridges the streak without being a completion. It deliberately does NOT
 * feed `isDayComplete` — conflating the two would inflate the completion rate,
 * which is the number people use to judge themselves honestly.
 */
export function skippedDaysOf(h: WithSkips): Set<number> {
    return new Set((h.skips ?? []).map((s) => s.day));
}

/** Whether one given day of the month is forgiven. */
export function isDaySkipped(h: WithSkips, day: number): boolean {
    return (h.skips ?? []).some((s) => s.day === day);
}

/** Skips this habit has left in the month its `skips` were fetched for. */
export function skipsLeft(h: WithSkips): number {
    return Math.max(0, SKIPS_PER_MONTH - (h.skips ?? []).length);
}
