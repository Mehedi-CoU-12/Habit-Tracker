import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiHabit } from "./types";
import { deriveHabitStats, deriveRangeStats, daysInMonth } from "./deriveStats";

/**
 * Fixtures. `logs` are day-of-month numbers in the habit's own month; the
 * year/month on each log row only has to match what the caller asks for.
 */
function habit(
    over: Partial<ApiHabit> & { days?: number[] } = {},
    year = 2026,
    month = 9,
): ApiHabit {
    const { days = [], ...rest } = over;
    return {
        id: "h1",
        name: "Read",
        goal: 20,
        icon: "book",
        tod: "evening",
        verb: null,
        userId: "u1",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        logs: days.map((day) => ({
            id: `l${day}`,
            habitId: "h1",
            userId: "u1",
            year,
            month,
            day,
            createdAt: "2026-09-01T00:00:00.000Z",
        })),
        ...rest,
    };
}

/** Sep 2026 has 30 days and opens on a Tuesday. */
const SEP = { year: 2026, month: 9, dim: 30 };
const on = (day: number) => new Date(SEP.year, SEP.month - 1, day);

describe("daysInMonth", () => {
    test("handles month lengths and leap years", () => {
        assert.equal(daysInMonth(2026, 9), 30);
        assert.equal(daysInMonth(2026, 2), 28);
        assert.equal(daysInMonth(2024, 2), 29);
        assert.equal(daysInMonth(2026, 12), 31);
    });
});

describe("deriveHabitStats — counts", () => {
    test("completed, left and percent come off the goal", () => {
        const s = deriveHabitStats(
            habit({ days: [1, 2, 3], goal: 10 }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(3),
        );
        assert.equal(s.completed, 3);
        assert.equal(s.left, 7);
        assert.equal(s.percent, 30);
    });

    test("left floors at zero once the goal is beaten", () => {
        const s = deriveHabitStats(
            habit({ days: [1, 2, 3, 4, 5], goal: 3 }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(5),
        );
        assert.equal(s.left, 0);
        assert.equal(s.percent, 167);
    });

    test("duplicate log rows for one day count once", () => {
        const h = habit({ days: [4, 4, 5] });
        const s = deriveHabitStats(h, SEP.year, SEP.month, SEP.dim, on(5));
        assert.equal(s.completed, 2);
    });
});

describe("deriveHabitStats — streak", () => {
    test("counts back consecutive days including today", () => {
        const s = deriveHabitStats(
            habit({ days: [3, 4, 5] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(5),
        );
        assert.equal(s.streak, 3);
        assert.equal(s.doneToday, true);
    });

    test("today still open does not read as broken — falls back to yesterday", () => {
        const s = deriveHabitStats(
            habit({ days: [3, 4] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(5),
        );
        assert.equal(s.streak, 2);
        assert.equal(s.doneToday, false);
    });

    test("a gap breaks the streak", () => {
        const s = deriveHabitStats(
            habit({ days: [1, 2, 5] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(5),
        );
        assert.equal(s.streak, 1);
    });

    test("no logs at all is a zero streak", () => {
        const s = deriveHabitStats(
            habit(),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(5),
        );
        assert.equal(s.streak, 0);
        assert.equal(s.best, 0);
        assert.equal(s.rate, 0);
    });
});

describe("deriveHabitStats — best run", () => {
    test("best is the longest run anywhere in the month", () => {
        const s = deriveHabitStats(
            habit({ days: [1, 2, 3, 4, 10, 11] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(12),
        );
        assert.equal(s.best, 4);
        // Today (the 12th) is still open, so the streak is the run ending
        // yesterday — the 10th-11th pair, not the longer earlier run.
        assert.equal(s.streak, 2);
    });
});

describe("deriveHabitStats — rate", () => {
    test("current month scores against days elapsed, not the whole month", () => {
        const s = deriveHabitStats(
            habit({ days: [1, 2, 3, 4, 5] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(10),
        );
        // 5 of the 10 elapsed days
        assert.equal(s.rate, 50);
    });

    test("a past month scores against the whole month", () => {
        const s = deriveHabitStats(
            habit({ days: [1, 2, 3] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            new Date(2026, 10, 15), // November — SEP is in the past
        );
        assert.equal(s.rate, 10); // 3/30
        assert.equal(s.doneToday, false);
    });
});

describe("deriveHabitStats — normalization", () => {
    test("unknown tod falls back to anytime and blank icon to sprout", () => {
        const s = deriveHabitStats(
            habit({ tod: "whenever", icon: "" }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(5),
        );
        assert.equal(s.tod, "anytime");
        assert.equal(s.icon, "sprout");
    });
});

describe("deriveRangeStats", () => {
    const range = (from: number, to: number) => ({
        start: on(from),
        end: on(to),
    });

    test("denominator starts at the habit's creation day, not the range start", () => {
        // Planted Sep 20; scored over Sep 1-30 it must not be judged on Sep 1-19.
        const h = habit({
            days: [20, 21, 22],
            createdAt: new Date(2026, 8, 20).toISOString(),
        });
        const [s] = deriveRangeStats(
            [{ year: SEP.year, month: SEP.month, habits: [h] }],
            [h],
            range(1, 30),
        );
        assert.equal(s!.completed, 3);
        assert.equal(s!.days, 11); // Sep 20..30 inclusive
        assert.equal(s!.rate, 27);
    });

    test("a backfilled day earlier than creation pulls the denominator back", () => {
        const h = habit({
            days: [5, 25],
            createdAt: new Date(2026, 8, 20).toISOString(),
        });
        const [s] = deriveRangeStats(
            [{ year: SEP.year, month: SEP.month, habits: [h] }],
            [h],
            range(1, 30),
        );
        assert.equal(s!.days, 26); // Sep 5..30
    });

    test("logs outside the range are ignored", () => {
        const h = habit({ days: [1, 2, 20] });
        const [s] = deriveRangeStats(
            [{ year: SEP.year, month: SEP.month, habits: [h] }],
            [h],
            range(1, 10),
        );
        assert.equal(s!.completed, 2);
    });
});

