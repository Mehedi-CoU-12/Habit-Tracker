import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiHabit } from "./types";
import { deriveHabitStats, deriveRangeStats, daysInMonth } from "./deriveStats";

/**
 * Fixtures. `logs` are day-of-month numbers in the habit's own month; the
 * year/month on each log row only has to match what the caller asks for.
 */
function habit(
    over: Partial<ApiHabit> & { days?: number[]; skipped?: number[] } = {},
    year = 2026,
    month = 9,
): ApiHabit {
    const { days = [], skipped = [], ...rest } = over;
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
        skips: skipped.map((day) => ({
            id: `s${day}`,
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

/**
 * September 2026 opens on a Tuesday, so a Mon/Wed/Fri habit is due on
 * Wed 2, Fri 4, Mon 7, Wed 9, Fri 11, ... and resting on everything else.
 */
const MWF = [1, 3, 5];

describe("deriveHabitStats — weekday schedules", () => {
    const stats = (days: number[], todayDom: number, over = {}) =>
        deriveHabitStats(
            habit({ days, daysOfWeek: MWF, ...over }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(todayDom),
        );

    test("a rest day neither extends nor breaks the streak", () => {
        // Due days done: Wed 2, Fri 4, Mon 7. Today is Tue 8 — a rest day.
        const s = stats([2, 4, 7], 8);
        assert.equal(s.streak, 3);
        assert.equal(s.scheduledToday, false);
    });

    test("an open due day falls back to the previous due day", () => {
        // Today is Wed 9, due but not yet done.
        const s = stats([2, 4, 7], 9);
        assert.equal(s.streak, 3);
        assert.equal(s.scheduledToday, true);
        assert.equal(s.doneToday, false);
    });

    test("missing a due day does break the streak", () => {
        // Fri 4 was due and skipped.
        const s = stats([2, 7], 7);
        assert.equal(s.streak, 1);
    });

    test("the rate is scored out of due days, not calendar days", () => {
        // All three due days through Mon 7 were done.
        const s = stats([2, 4, 7], 7);
        assert.equal(s.rate, 100);
        // The same logs judged as a daily habit would be 3 of 7.
        const asDaily = deriveHabitStats(
            habit({ days: [2, 4, 7] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(7),
        );
        assert.equal(asDaily.rate, 43);
    });

    test("a bonus completion on a rest day cannot push the rate over 100", () => {
        // Tue 1 is a rest day; the three due days are all done.
        const s = stats([1, 2, 4, 7], 7);
        assert.equal(s.completed, 4); // still counted for goal progress
        assert.equal(s.rate, 100);
    });

    test("best chains along due days", () => {
        // Wed 2, Fri 4, Mon 7, Wed 9 is an unbroken run of 4 due days.
        const s = stats([2, 4, 7, 9], 9);
        assert.equal(s.best, 4);
    });

    test("all seven days is the same as no schedule", () => {
        const every = deriveHabitStats(
            habit({ days: [1, 2, 3], daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(3),
        );
        const none = deriveHabitStats(
            habit({ days: [1, 2, 3] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(3),
        );
        assert.deepEqual(every.daysOfWeek, []);
        assert.equal(every.streak, none.streak);
        assert.equal(every.rate, none.rate);
    });

    test("archivedAt is surfaced for the caller to filter on", () => {
        const iso = new Date(2026, 8, 5).toISOString();
        const s = deriveHabitStats(
            habit({ archivedAt: iso }),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(10),
        );
        assert.equal(s.archivedAt, iso);
    });
});

describe("deriveRangeStats — weekday schedules", () => {
    test("denominator counts due days only", () => {
        const h = habit({ days: [2, 4, 7], daysOfWeek: MWF });
        const [s] = deriveRangeStats(
            [{ year: SEP.year, month: SEP.month, habits: [h] }],
            [h],
            { start: on(1), end: on(7) },
        );
        assert.equal(s!.days, 3); // Wed 2, Fri 4, Mon 7
        assert.equal(s!.rate, 100);
    });

    test("a full month of a Mon/Wed/Fri habit is scored out of 13", () => {
        const h = habit({ days: [], daysOfWeek: MWF });
        const [s] = deriveRangeStats(
            [{ year: SEP.year, month: SEP.month, habits: [h] }],
            [h],
            { start: on(1), end: on(30) },
        );
        assert.equal(s!.days, 13);
        assert.equal(s!.rate, 0);
    });
});

describe("deriveRangeStats — archived habits", () => {
    test("the denominator stops at the archive date", () => {
        const h = habit({
            days: [1, 2, 3],
            archivedAt: new Date(2026, 8, 3).toISOString(),
        });
        const [s] = deriveRangeStats(
            [{ year: SEP.year, month: SEP.month, habits: [h] }],
            [h],
            { start: on(1), end: on(30) },
        );
        assert.equal(s!.days, 3); // Sep 1..3, not Sep 1..30
        assert.equal(s!.rate, 100);
    });

    test("without archiving the same habit keeps accruing misses", () => {
        const h = habit({ days: [1, 2, 3] });
        const [s] = deriveRangeStats(
            [{ year: SEP.year, month: SEP.month, habits: [h] }],
            [h],
            { start: on(1), end: on(30) },
        );
        assert.equal(s!.days, 30);
        assert.equal(s!.rate, 10);
    });
});

describe("deriveHabitStats — streak insurance", () => {
    const stats = (over: Parameters<typeof habit>[0], day: number) =>
        deriveHabitStats(
            habit(over),
            SEP.year,
            SEP.month,
            SEP.dim,
            on(day),
        );

    test("a habit with no skips is byte-identical to before", () => {
        const withField = stats({ days: [1, 2, 3, 4, 5] }, 5);
        const withoutField = deriveHabitStats(
            { ...habit({ days: [1, 2, 3, 4, 5] }), skips: undefined },
            SEP.year,
            SEP.month,
            SEP.dim,
            on(5),
        );
        assert.deepEqual(
            { ...withField, skippedDays: [], skipsLeft: 1 },
            { ...withoutField, skippedDays: [], skipsLeft: 1 },
        );
        assert.equal(withField.streak, 5);
    });

    test("a spent skip spans the gap", () => {
        // Missed the 3rd; without the skip the streak would be 2 (4th, 5th).
        assert.equal(stats({ days: [1, 2, 4, 5] }, 5).streak, 2);
        assert.equal(stats({ days: [1, 2, 4, 5], skipped: [3] }, 5).streak, 4);
    });

    test("the rate is unchanged by a skip — it is not a completion", () => {
        const plain = stats({ days: [1, 2, 4, 5] }, 5);
        const forgiven = stats({ days: [1, 2, 4, 5], skipped: [3] }, 5);
        assert.equal(forgiven.rate, plain.rate);
        assert.equal(forgiven.rate, 80); // 4 of 5 elapsed days
        assert.equal(forgiven.completed, plain.completed);
    });

    test("a skip does not extend best", () => {
        const forgiven = stats({ days: [1, 2, 4, 5], skipped: [3] }, 5);
        assert.equal(forgiven.streak, 4);
        assert.equal(forgiven.best, 2); // the honest high-water mark
    });

    test("reports the days forgiven and the allowance left", () => {
        assert.deepEqual(stats({ days: [1], skipped: [3] }, 5).skippedDays, [
            3,
        ]);
        assert.equal(stats({ days: [1], skipped: [3] }, 5).skipsLeft, 0);
        assert.equal(stats({ days: [1] }, 5).skipsLeft, 1);
    });

    test("a run of two forgiven days is bridged too", () => {
        assert.equal(
            stats({ days: [1, 2, 5], skipped: [3, 4] }, 5).streak,
            3,
        );
    });

    test("an unforgiven miss still breaks the run", () => {
        // The 3rd is forgiven, the 2nd is simply missed.
        assert.equal(stats({ days: [1, 4, 5], skipped: [3] }, 5).streak, 2);
    });
});
