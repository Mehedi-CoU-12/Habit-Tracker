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

export type HeatCell = { week: number; day: number; level: number };

/** Number of week-columns shown in the ~6-month heatmap grid. */
export const HEATMAP_WEEKS = 26;

/** Stable key for a calendar day, matching the API's year/month/day ints. */
export function dateKey(year: number, month: number, day: number): string {
    return `${year}-${month}-${day}`;
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

/**
 * Build the trailing 26-week heatmap grid ending with the current week.
 * Columns are weeks (oldest → newest), rows are weekdays (Sun → Sat), matching
 * the SVG layout (`x = week * 12`, `y = day * 12`). `levelForDate` returns the
 * 0–4 intensity for a given calendar day; future days are forced to 0.
 */
export function buildHeatmapGrid(
    today: Date,
    levelForDate: (date: Date) => number,
): HeatCell[] {
    const cells: HeatCell[] = [];
    // Midnight today, then the Sunday that starts the current (rightmost) week.
    const end = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    const start = new Date(end);
    start.setDate(end.getDate() - end.getDay() - (HEATMAP_WEEKS - 1) * 7);
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
        for (let d = 0; d < 7; d++) {
            const date = new Date(start);
            date.setDate(start.getDate() + w * 7 + d);
            const level = date > end ? 0 : levelForDate(date);
            cells.push({ week: w, day: d, level });
        }
    }
    return cells;
}
