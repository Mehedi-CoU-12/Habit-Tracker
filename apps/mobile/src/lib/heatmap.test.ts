import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiHabit } from "./types";
import { MonthHabits } from "./deriveStats";
import { dayIndexOf } from "./date";
import {
    buildActivityHeatmap,
    buildHabitHeatmap,
    habitHistoryStats,
    heatRange,
    monthsForHeat,
} from "./heatmap";

function habit(over: Partial<ApiHabit> & { days?: number[] } = {}): ApiHabit {
    const { days = [], ...rest } = over;
    const year = 2026;
    const month = 9;
    return {
        id: "h1",
        name: "Read",
        goal: 20,
        icon: "book",
        tod: "evening",
        verb: null,
        userId: "u1",
        createdAt: new Date(2026, 8, 1).toISOString(),
        updatedAt: new Date(2026, 8, 1).toISOString(),
        logs: days.map((day) => ({
            id: `l${day}`,
            habitId: (rest.id as string) ?? "h1",
            userId: "u1",
            year,
            month,
            day,
            createdAt: new Date(2026, 8, day).toISOString(),
        })),
        ...rest,
    };
}

/** One loaded month of history, September 2026. */
function sep(habits: ApiHabit[], loaded = true): MonthHabits[] {
    return [{ year: 2026, month: 9, habits, loaded }];
}

const on = (day: number) => new Date(2026, 8, day);
const idx = (day: number) => dayIndexOf(2026, 9, day);

describe("heatRange", () => {
    test("Week is the trailing 7 days ending today", () => {
        const r = heatRange("Week", on(10));
        assert.equal(r.start.getDate(), 4);
        assert.equal(r.end.getDate(), 10);
    });

    test("Month opens on the 1st and ends today", () => {
        const r = heatRange("Month", on(10));
        assert.equal(r.start.getDate(), 1);
        assert.equal(r.start.getMonth(), 8);
        assert.equal(r.end.getDate(), 10);
    });

    test("Year opens on Jan 1", () => {
        const r = heatRange("Year", on(10));
        assert.equal(r.start.getMonth(), 0);
        assert.equal(r.start.getDate(), 1);
    });
});

describe("monthsForHeat", () => {
    test("Week mid-month needs one month, Year needs the months elapsed", () => {
        assert.equal(monthsForHeat("Week", on(10)), 1);
        assert.equal(monthsForHeat("Month", on(10)), 1);
        assert.equal(monthsForHeat("Year", on(10)), 9); // Jan..Sep
    });

    test("a Week spanning the 1st reaches back into the previous month", () => {
        assert.equal(monthsForHeat("Week", on(3)), 2);
    });
});

describe("buildHabitHeatmap — summary", () => {
    test("scores every day from planting to today", () => {
        const h = habit({ days: [1, 2, 3, 4, 5] });
        const r = buildHabitHeatmap(sep([h]), "h1", "Month", on(10), h);
        assert.equal(r.summary.completed, 5);
        assert.equal(r.summary.expected, 10); // Sep 1..10
        assert.equal(r.summary.rate, 50);
        assert.equal(r.summary.best, 5);
    });

    test("days before planting are not counted against the habit", () => {
        const h = habit({
            days: [21, 22],
            createdAt: new Date(2026, 8, 20).toISOString(),
        });
        const r = buildHabitHeatmap(sep([h]), "h1", "Month", on(25), h);
        assert.equal(r.summary.expected, 6); // Sep 20..25
        assert.equal(r.summary.completed, 2);
    });

    test("an unloaded month contributes no expected days", () => {
        const h = habit({ days: [1, 2] });
        const r = buildHabitHeatmap(sep([h], false), "h1", "Month", on(10), h);
        assert.equal(r.summary.expected, 0);
        assert.equal(r.summary.rate, 0);
    });

    test("best is the longest run inside the window", () => {
        const h = habit({ days: [1, 2, 3, 7, 8] });
        const r = buildHabitHeatmap(sep([h]), "h1", "Month", on(10), h);
        assert.equal(r.summary.best, 3);
    });
});

describe("buildHabitHeatmap — grid", () => {
    const gridFor = (day: number) => {
        const h = habit({ days: [1, 2, 3] });
        return buildHabitHeatmap(sep([h]), "h1", "Month", on(day), h).grid;
    };

    test("marks days past today as future, never as missed", () => {
        const grid = gridFor(10);
        const future = grid.days.filter((d) => d.future);
        assert.ok(future.length > 0);
        assert.ok(future.every((d) => d.day > 10));
        assert.ok(future.every((d) => !d.done));
    });

    test("exactly one cell is today", () => {
        const grid = gridFor(10);
        const today = grid.days.filter((d) => d.today);
        assert.equal(today.length, 1);
        assert.equal(today[0]!.day, 10);
    });

    test("completed days carry a level and done flag", () => {
        const grid = gridFor(10);
        const first = grid.days.find((d) => d.index === idx(1))!;
        assert.equal(first.done, true);
        assert.ok(first.level > 0);
        const missed = grid.days.find((d) => d.index === idx(5))!;
        assert.equal(missed.done, false);
        assert.equal(missed.level, 0);
    });

    test("run depth shades later days of a streak more strongly", () => {
        const grid = gridFor(10);
        const day1 = grid.days.find((d) => d.index === idx(1))!;
        const day3 = grid.days.find((d) => d.index === idx(3))!;
        assert.ok(day3.level > day1.level);
    });

    test("the calendar layout places the 1st on its real weekday", () => {
        const grid = gridFor(10);
        // Sep 1 2026 is a Tuesday → column 2 (0 = Sunday).
        const first = grid.days.find((d) => d.index === idx(1))!;
        assert.equal(grid.layout, "calendar");
        assert.equal(first.col, 2);
        assert.equal(first.row, 0);
    });
});

describe("habitHistoryStats", () => {
    test("streak counts the run ending today", () => {
        const h = habit({ days: [8, 9, 10] });
        const s = habitHistoryStats(sep([h]), "h1", on(10), h);
        assert.equal(s.streak, 3);
    });

    test("today still open falls back to the run ending yesterday", () => {
        const h = habit({ days: [8, 9] });
        const s = habitHistoryStats(sep([h]), "h1", on(10), h);
        assert.equal(s.streak, 2);
    });

    test("a two-day gap zeroes the streak", () => {
        const h = habit({ days: [1, 2, 3] });
        const s = habitHistoryStats(sep([h]), "h1", on(10), h);
        assert.equal(s.streak, 0);
        assert.equal(s.best, 3);
    });

    test("streaks span a month boundary", () => {
        // Aug 30, Aug 31, Sep 1 — a 3-day run across the month edge.
        const h: ApiHabit = {
            ...habit(),
            logs: [
                { year: 2026, month: 8, day: 30 },
                { year: 2026, month: 8, day: 31 },
                { year: 2026, month: 9, day: 1 },
            ].map((d, i) => ({
                id: `l${i}`,
                habitId: "h1",
                userId: "u1",
                createdAt: "",
                ...d,
            })),
            createdAt: new Date(2026, 7, 30).toISOString(),
        };
        const history: MonthHabits[] = [
            { year: 2026, month: 8, habits: [h], loaded: true },
            { year: 2026, month: 9, habits: [h], loaded: true },
        ];
        const s = habitHistoryStats(history, "h1", on(1), h);
        assert.equal(s.streak, 3);
        assert.equal(s.best, 3);
    });

    test("rate is scored from the planting day", () => {
        const h = habit({
            days: [20, 21],
            createdAt: new Date(2026, 8, 20).toISOString(),
        });
        const s = habitHistoryStats(sep([h]), "h1", on(21), h);
        assert.equal(s.completed, 2);
        assert.equal(s.rate, 100); // 2 of Sep 20..21
    });
});

describe("buildActivityHeatmap", () => {
    test("a day's share is out of the habits alive that day", () => {
        const a = habit({ id: "a", days: [1, 2] });
        const b: ApiHabit = {
            ...habit({ id: "b", days: [2] }),
            createdAt: new Date(2026, 8, 2).toISOString(),
        };
        const r = buildActivityHeatmap(sep([a, b]), "Month", on(2));
        // Sep 1: 1 of 1 habit. Sep 2: 2 of 2. Both perfect.
        assert.equal(r.summary.completed, 3);
        assert.equal(r.summary.expected, 3);
        assert.equal(r.summary.perfect, 2);
        assert.equal(r.summary.rate, 100);
    });

    test("a habit planted later does not retroactively count as missed", () => {
        const a = habit({ id: "a", days: [1] });
        const b: ApiHabit = {
            ...habit({ id: "b", days: [] }),
            createdAt: new Date(2026, 8, 5).toISOString(),
        };
        const r = buildActivityHeatmap(sep([a, b]), "Month", on(1));
        // Only habit a existed on Sep 1, and it was done.
        assert.equal(r.summary.expected, 1);
        assert.equal(r.summary.perfect, 1);
    });

    test("an unloaded month contributes nothing", () => {
        const a = habit({ id: "a", days: [1, 2] });
        const r = buildActivityHeatmap(sep([a], false), "Month", on(2));
        assert.equal(r.summary.expected, 0);
    });
});

/** Sep 2026 opens on a Tuesday; Mon/Wed/Fri is due Wed 2, Fri 4, Mon 7, ... */
const MWF = [1, 3, 5];

describe("buildHabitHeatmap — weekday schedules", () => {
    test("expected counts due days only", () => {
        const h = habit({ days: [2, 4, 7, 9], daysOfWeek: MWF });
        const r = buildHabitHeatmap(sep([h]), "h1", "Month", on(10), h);
        // Due days Sep 1..10: Wed 2, Fri 4, Mon 7, Wed 9.
        assert.equal(r.summary.expected, 4);
        assert.equal(r.summary.completed, 4);
        assert.equal(r.summary.rate, 100);
    });

    test("rest days render dormant, not missed", () => {
        const h = habit({ days: [2, 4], daysOfWeek: MWF });
        const grid = buildHabitHeatmap(sep([h]), "h1", "Month", on(10), h).grid;
        const tue1 = grid.days.find((d) => d.index === idx(1))!;
        const thu3 = grid.days.find((d) => d.index === idx(3))!;
        const fri4 = grid.days.find((d) => d.index === idx(4))!;
        assert.equal(tue1.dormant, true);
        assert.equal(thu3.dormant, true);
        assert.equal(fri4.dormant, false);
        assert.equal(fri4.done, true);
    });

    test("a missed due day is still shown as missed", () => {
        const h = habit({ days: [2], daysOfWeek: MWF });
        const grid = buildHabitHeatmap(sep([h]), "h1", "Month", on(10), h).grid;
        const fri4 = grid.days.find((d) => d.index === idx(4))!;
        assert.equal(fri4.dormant, false);
        assert.equal(fri4.done, false);
    });

    test("run depth chains across the rest days between due days", () => {
        const h = habit({ days: [2, 4, 7], daysOfWeek: MWF });
        const grid = buildHabitHeatmap(sep([h]), "h1", "Month", on(7), h).grid;
        const mon7 = grid.days.find((d) => d.index === idx(7))!;
        // Third due day in a row, so it must read as a deeper run than an
        // isolated day — Tuesday in between is not a gap.
        assert.equal(mon7.detail, "done · 3 day run");
    });

    test("the same logs read as a broken run for a daily habit", () => {
        const h = habit({ days: [2, 4, 7] });
        const grid = buildHabitHeatmap(sep([h]), "h1", "Month", on(7), h).grid;
        const mon7 = grid.days.find((d) => d.index === idx(7))!;
        assert.equal(mon7.detail, undefined); // depth 1, no run
    });
});
