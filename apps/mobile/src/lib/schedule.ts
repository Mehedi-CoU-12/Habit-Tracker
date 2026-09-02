/** Weekday of a day index, 0 = Sunday. */
export function weekdayOfIndex(dayIdx: number): number {
    return ((((dayIdx % 7) + 7) % 7) + 4) % 7;
}

/** A schedule that covers every day — the stored form is the empty list. */
export function isDaily(daysOfWeek: number[] | undefined | null): boolean {
    return !daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.length >= 7;
}

/** Drop anything that isn't a weekday number, then dedupe and sort. */
export function normalizeDays(
    daysOfWeek: number[] | undefined | null,
): number[] {
    if (!daysOfWeek?.length) return [];
    const clean = new Set<number>();
    for (const d of daysOfWeek) {
        if (Number.isInteger(d) && d >= 0 && d <= 6) clean.add(d);
    }

    if (clean.size >= 7) return [];
    return [...clean].sort((a, b) => a - b);
}

/** Was this habit due on the given day index? */
export function isExpectedOn(
    daysOfWeek: number[] | undefined | null,
    dayIdx: number,
): boolean {
    if (isDaily(daysOfWeek)) return true;
    return daysOfWeek!.includes(weekdayOfIndex(dayIdx));
}

/** Was this habit due on the given local date? */
export function isExpectedOnDate(
    daysOfWeek: number[] | undefined | null,
    date: Date,
): boolean {
    if (isDaily(daysOfWeek)) return true;
    return daysOfWeek!.includes(date.getDay());
}

export function expectedDaysBetween(
    daysOfWeek: number[] | undefined | null,
    from: number,
    to: number,
): number {
    if (to < from) return 0;
    const total = to - from + 1;
    if (isDaily(daysOfWeek)) return total;

    const weeks = Math.floor(total / 7);
    let count = weeks * daysOfWeek!.length;
    // The ragged tail: the days after the last whole week.
    for (let i = weeks * 7; i < total; i++) {
        if (daysOfWeek!.includes(weekdayOfIndex(from + i))) count++;
    }
    return count;
}

/** The previous day index on which the habit was due, at or before `dayIdx`. */
export function previousExpected(
    daysOfWeek: number[] | undefined | null,
    dayIdx: number,
): number {
    if (isDaily(daysOfWeek)) return dayIdx;
    // At most 7 steps back reaches a scheduled weekday for any non-empty set.
    for (let i = 0; i < 7; i++) {
        if (daysOfWeek!.includes(weekdayOfIndex(dayIdx - i))) return dayIdx - i;
    }
    return dayIdx;
}

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FULL = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

/** Human label for a schedule, for habit rows and the detail header. */
export function scheduleLabel(daysOfWeek: number[] | undefined | null): string {
    const days = normalizeDays(daysOfWeek);
    if (days.length === 0) return "Every day";
    if (days.length === 5 && days.join() === "1,2,3,4,5") return "Weekdays";
    if (days.length === 2 && days.join() === "0,6") return "Weekends";
    if (days.length === 1) return `${FULL[days[0]!]}s`;
    return days.map((d) => SHORT[d]).join(", ");
}
