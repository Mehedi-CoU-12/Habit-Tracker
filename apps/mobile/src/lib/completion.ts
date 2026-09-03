/** The one place that decides whether a habit's day counts as done. */

type Log = { day: number; amount?: number };
type Quantified = { target?: number | null };
type WithLogs<L extends Log> = Quantified & { logs: L[] };

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
export function progressOn<L extends Log>(h: WithLogs<L>, day: number): number {
    return Math.min(1, amountOn(h, day) / targetOf(h));
}
