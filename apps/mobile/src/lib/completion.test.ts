import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiHabit } from "./types";
import {
    amountOn,
    completedDaysOf,
    isDayComplete,
    isQuantified,
    progressOn,
    targetOf,
} from "./completion";
import { deriveHabitStats } from "./deriveStats";

/** A habit whose logs carry explicit amounts, keyed by day-of-month. */
function habit(
    amounts: Record<number, number | undefined>,
    over: Partial<ApiHabit> = {},
): ApiHabit {
    return {
        id: "h1",
        name: "Drink water",
        goal: 20,
        icon: "droplet",
        tod: "morning",
        verb: null,
        userId: "u1",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        logs: Object.entries(amounts).map(([day, amount]) => ({
            id: `l${day}`,
            habitId: "h1",
            userId: "u1",
            year: 2026,
            month: 9,
            day: Number(day),
            ...(amount === undefined ? {} : { amount }),
            createdAt: "2026-09-01T00:00:00.000Z",
        })),
        ...over,
    };
}

describe("binary habits are unchanged", () => {
    test("no target means a target of 1", () => {
        const h = habit({ 1: undefined, 2: undefined });
        assert.equal(targetOf(h), 1);
        assert.equal(isQuantified(h), false);
        assert.deepEqual([...completedDaysOf(h)].sort(), [1, 2]);
    });

    test("a log row with no amount still completes its day", () => {
        // This is every row written before the amount column existed.
        const h = habit({ 5: undefined });
        assert.equal(isDayComplete(h, 5), true);
        assert.equal(amountOn(h, 5), 1);
    });
});

describe("quantified habits", () => {
    test("a partial day is not complete", () => {
        const h = habit({ 1: 3 }, { target: 8 });
        assert.equal(isDayComplete(h, 1), false);
        assert.equal(amountOn(h, 1), 3);
        assert.equal(completedDaysOf(h).size, 0);
    });

    test("reaching the target completes the day", () => {
        const h = habit({ 1: 8 }, { target: 8 });
        assert.equal(isDayComplete(h, 1), true);
    });

    test("exceeding the target completes it once, not twice", () => {
        const h = habit({ 1: 20 }, { target: 8 });
        assert.equal(isDayComplete(h, 1), true);
        assert.equal(completedDaysOf(h).size, 1);
        assert.equal(progressOn(h, 1), 1);
    });

    test("a day with no log is zero, not complete", () => {
        const h = habit({ 1: 8 }, { target: 8 });
        assert.equal(amountOn(h, 2), 0);
        assert.equal(isDayComplete(h, 2), false);
        assert.equal(progressOn(h, 2), 0);
    });

    test("progress is the fraction of the target", () => {
        const h = habit({ 1: 2 }, { target: 8 });
        assert.equal(progressOn(h, 1), 0.25);
    });
});

describe("deriveHabitStats over amounts", () => {
    /** Sep 2026 has 30 days. Reference day is the 5th. */
    const on5th = new Date(2026, 8, 5);

    test("partial days break the streak, full ones extend it", () => {
        // 1,2,3 full; 4 partial; 5 full → today's run is just the 5th.
        const h = habit({ 1: 8, 2: 8, 3: 8, 4: 3, 5: 8 }, { target: 8 });
        const s = deriveHabitStats(h, 2026, 9, 30, on5th);
        assert.equal(s.streak, 1);
        assert.equal(s.best, 3);
        assert.equal(s.completed, 4);
        assert.equal(s.doneToday, true);
        assert.equal(s.todayAmount, 8);
    });

    test("a partial today is not done, and does not break the run yet", () => {
        // The day is still open, so the streak falls back to the 4th.
        const h = habit({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 3 }, { target: 8 });
        const s = deriveHabitStats(h, 2026, 9, 30, on5th);
        assert.equal(s.doneToday, false);
        assert.equal(s.todayAmount, 3);
        assert.equal(s.streak, 4);
    });

    test("the rate counts only days that reached the target", () => {
        const h = habit({ 1: 8, 2: 4, 3: 8, 4: 0, 5: 8 }, { target: 8 });
        const s = deriveHabitStats(h, 2026, 9, 30, on5th);
        // 3 of the 5 elapsed days reached 8.
        assert.equal(s.rate, 60);
    });

    test("target, unit and step are surfaced with sane fallbacks", () => {
        const q = deriveHabitStats(
            habit({}, { target: 30, unit: "min", step: 5 }),
            2026,
            9,
            30,
            on5th,
        );
        assert.equal(q.target, 30);
        assert.equal(q.unit, "min");
        assert.equal(q.step, 5);

        const b = deriveHabitStats(habit({}), 2026, 9, 30, on5th);
        assert.equal(b.target, null);
        assert.equal(b.unit, null);
        assert.equal(b.step, 1);
        assert.equal(b.todayAmount, 0);
    });
});
