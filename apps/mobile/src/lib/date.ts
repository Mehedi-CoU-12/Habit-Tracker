export const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
export const dayNamesFull = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
export const monthShort = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** Stable key for a calendar day, matching the API's year/month/day ints. */
export function dateKey(year: number, month: number, day: number): string {
    return `${year}-${month}-${day}`;
}

/** Midnight-aligned copy of a date, in the device's local time. */
export function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Midnight `n` days from `d`. Goes through the Date constructor rather than
 * millisecond arithmetic so it lands on local midnight across DST boundaries.
 */
export function addDays(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** The Sunday that opens the local week containing `d`. */
export function startOfWeek(d: Date): Date {
    return addDays(d, -d.getDay());
}

/** Last calendar day of `d`'s month. */
export function endOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * Days since the epoch for a calendar day. UTC does the arithmetic on parts
 * that are already local (the same trick the API's focus stats use), so day
 * counts stay exact across DST shifts — subtracting two local midnights
 * doesn't, since one of them can be 23 or 25 hours wide.
 */
export function dayIndexOf(year: number, month: number, day: number): number {
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function dayIndex(d: Date): number {
    return dayIndexOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** An inclusive span of local calendar days. */
export type DayRange = { start: Date; end: Date };

/** Calendar months a range touches — how much history to fetch to cover it. */
export function monthsSpanned(range: DayRange): number {
    return (
        (range.end.getFullYear() - range.start.getFullYear()) * 12 +
        (range.end.getMonth() - range.start.getMonth()) +
        1
    );
}

/**
 * The (year, month) pairs for the current month and the previous `n - 1`
 * months — used to fetch enough month-scoped logs to fill the heatmap grid.
 */
export function lastNMonths(
    today: Date,
    n: number,
): { year: number; month: number }[] {
    const out: { year: number; month: number }[] = [];
    let y = today.getFullYear();
    let m = today.getMonth() + 1; // 1-12
    for (let i = 0; i < n; i++) {
        out.push({ year: y, month: m });
        m--;
        if (m < 1) {
            m = 12;
            y--;
        }
    }
    return out;
}
