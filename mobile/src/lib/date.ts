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

/** Deterministic pseudo-random for stable heatmap fill. */
export function seededRand(seed: number): number {
    let x = seed * 9301 + 49297;
    x = x % 233280;
    return x / 233280;
}

export type HeatCell = { week: number; day: number; level: number };

/** 26-week (~6mo) heatmap data, denser toward recent weeks. */
export function buildYearData(seed = 7): HeatCell[] {
    const cells: HeatCell[] = [];
    for (let w = 0; w < 26; w++) {
        for (let d = 0; d < 7; d++) {
            const r = seededRand(w * 7 + d + seed);
            const recency = w / 26;
            const t = r * 0.7 + recency * 0.4;
            let level = 0;
            if (t > 0.35) level = 1;
            if (t > 0.55) level = 2;
            if (t > 0.75) level = 3;
            if (t > 0.9) level = 4;
            cells.push({ week: w, day: d, level });
        }
    }
    return cells;
}
