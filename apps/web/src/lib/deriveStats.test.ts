import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiHabit } from "../../app/dashboard/types";
import { deriveHabitStats } from "./deriveStats";

/**
 * These mirror apps/mobile/src/lib/deriveStats.test.ts on purpose: the two
 * clients keep separate copies of this maths, and they must not drift.
 */
function habit(over: Partial<ApiHabit> & { days?: number[] } = {}): ApiHabit {
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
            year: 2026,
            month: 9,
            day,
            createdAt: "2026-09-01T00:00:00.000Z",
        })),
        ...rest,
    };
}

/** September 2026 has 30 days and opens on a Tuesday. */
const SEP = { year: 2026, month: 9, dim: 30 };
const on = (day: number) => new Date(SEP.year, SEP.month - 1, day);
const stats = (h: ApiHabit, todayDom: number) =>
    deriveHabitStats(h, SEP.year, SEP.month, SEP.dim, on(todayDom));

/** Mon/Wed/Fri: due Wed 2, Fri 4, Mon 7, Wed 9, ... in Sep 2026. */
const MWF = [1, 3, 5];

describe("deriveHabitStats — daily habits are unchanged", () => {
    test("counts, streak and rate for a plain daily habit", () => {
        const s = stats(habit({ days: [3, 4, 5], goal: 10 }), 5);
        assert.equal(s.completed, 3);
        assert.equal(s.left, 7);
        assert.equal(s.percent, 30);
        assert.equal(s.streak, 3);
        assert.equal(s.doneToday, true);
        assert.equal(s.rate, 60); // 3 of 5 elapsed days
    });

    test("today still open falls back to yesterday's run", () => {
        const s = stats(habit({ days: [3, 4] }), 5);
        assert.equal(s.streak, 2);
        assert.equal(s.doneToday, false);
    });

    test("a gap breaks the streak", () => {
        assert.equal(stats(habit({ days: [1, 2, 5] }), 5).streak, 1);
    });

    test("best is the longest run in the month", () => {
        assert.equal(stats(habit({ days: [1, 2, 3, 4, 10, 11] }), 12).best, 4);
    });

    test("a past month is scored against the whole month", () => {
        const s = deriveHabitStats(
            habit({ days: [1, 2, 3] }),
            SEP.year,
            SEP.month,
            SEP.dim,
            new Date(2026, 10, 15),
        );
        assert.equal(s.rate, 10);
        assert.equal(s.doneToday, false);
    });

    test("a habit with no schedule reports daily", () => {
        const s = stats(habit(), 5);
        assert.deepEqual(s.daysOfWeek, []);
        assert.equal(s.scheduledToday, true);
    });
});

describe("deriveHabitStats — weekday schedules", () => {
    test("a rest day neither extends nor breaks the streak", () => {
        // Due days done: Wed 2, Fri 4, Mon 7. Today is Tue 8 — a rest day.
        const s = stats(habit({ days: [2, 4, 7], daysOfWeek: MWF }), 8);
        assert.equal(s.streak, 3);
        assert.equal(s.scheduledToday, false);
    });

    test("an open due day falls back to the previous due day", () => {
        const s = stats(habit({ days: [2, 4, 7], daysOfWeek: MWF }), 9);
        assert.equal(s.streak, 3);
        assert.equal(s.scheduledToday, true);
    });

    test("missing a due day does break the streak", () => {
        // Fri 4 was due and skipped.
        assert.equal(stats(habit({ days: [2, 7], daysOfWeek: MWF }), 7).streak, 1);
    });

    test("the rate is scored out of due days, not calendar days", () => {
        const scheduled = stats(habit({ days: [2, 4, 7], daysOfWeek: MWF }), 7);
        const asDaily = stats(habit({ days: [2, 4, 7] }), 7);
        assert.equal(scheduled.rate, 100);
        assert.equal(asDaily.rate, 43);
    });

    test("a bonus completion on a rest day cannot exceed 100", () => {
        const s = stats(habit({ days: [1, 2, 4, 7], daysOfWeek: MWF }), 7);
        assert.equal(s.completed, 4);
        assert.equal(s.rate, 100);
    });

    test("best chains along due days", () => {
        const s = stats(habit({ days: [2, 4, 7, 9], daysOfWeek: MWF }), 9);
        assert.equal(s.best, 4);
    });

    test("all seven days is the same as no schedule", () => {
        const every = stats(
            habit({ days: [1, 2, 3], daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }),
            3,
        );
        const none = stats(habit({ days: [1, 2, 3] }), 3);
        assert.deepEqual(every.daysOfWeek, []);
        assert.equal(every.streak, none.streak);
        assert.equal(every.rate, none.rate);
    });
});

describe("deriveHabitStats — archiving", () => {
    test("archivedAt is surfaced so callers can filter on it", () => {
        const iso = new Date(2026, 8, 5).toISOString();
        assert.equal(stats(habit({ archivedAt: iso }), 10).archivedAt, iso);
    });

    test("a live habit reports null", () => {
        assert.equal(stats(habit(), 10).archivedAt, null);
    });
});
