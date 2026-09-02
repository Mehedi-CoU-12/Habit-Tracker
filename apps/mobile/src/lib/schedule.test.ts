import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { dayIndexOf } from "./date";
import {
    expectedDaysBetween,
    isDaily,
    isExpectedOn,
    isExpectedOnDate,
    normalizeDays,
    previousExpected,
    scheduleLabel,
    weekdayOfIndex,
} from "./schedule";

const MWF = [1, 3, 5];
const idx = (year: number, month: number, day: number) =>
    dayIndexOf(year, month, day);

describe("weekdayOfIndex", () => {
    test("agrees with Date.getDay() across a full week", () => {
        for (let day = 1; day <= 14; day++) {
            const d = new Date(2026, 8, day); // September 2026
            assert.equal(
                weekdayOfIndex(idx(2026, 9, day)),
                d.getDay(),
                `Sep ${day}`,
            );
        }
    });

    test("the epoch itself is a Thursday", () => {
        assert.equal(weekdayOfIndex(0), 4);
    });

    test("handles pre-epoch indices without going negative", () => {
        const w = weekdayOfIndex(-1);
        assert.ok(w >= 0 && w <= 6);
        assert.equal(w, 3); // 1969-12-31 was a Wednesday
    });
});

describe("isDaily / normalizeDays", () => {
    test("empty, missing and all-seven all mean daily", () => {
        assert.equal(isDaily([]), true);
        assert.equal(isDaily(undefined), true);
        assert.equal(isDaily(null), true);
        assert.equal(isDaily([0, 1, 2, 3, 4, 5, 6]), true);
        assert.equal(isDaily(MWF), false);
    });

    test("normalize dedupes, sorts and collapses all-seven to daily", () => {
        assert.deepEqual(normalizeDays([5, 1, 3, 1]), [1, 3, 5]);
        assert.deepEqual(normalizeDays([0, 1, 2, 3, 4, 5, 6]), []);
        assert.deepEqual(normalizeDays(undefined), []);
    });

    test("out-of-range and non-integer values are dropped", () => {
        assert.deepEqual(normalizeDays([1, 7, -1, 2.5, 3]), [1, 3]);
    });
});

describe("isExpectedOn", () => {
    test("a daily habit is due every day", () => {
        for (let day = 1; day <= 7; day++) {
            assert.equal(isExpectedOn([], idx(2026, 9, day)), true);
        }
    });

    test("Mon/Wed/Fri is due on exactly those weekdays", () => {
        // Sep 2026: 1st = Tue. So Mon 7, Wed 2, Fri 4 are due; Tue 1, Sat 5 not.
        assert.equal(isExpectedOn(MWF, idx(2026, 9, 7)), true); // Monday
        assert.equal(isExpectedOn(MWF, idx(2026, 9, 2)), true); // Wednesday
        assert.equal(isExpectedOn(MWF, idx(2026, 9, 4)), true); // Friday
        assert.equal(isExpectedOn(MWF, idx(2026, 9, 1)), false); // Tuesday
        assert.equal(isExpectedOn(MWF, idx(2026, 9, 5)), false); // Saturday
    });

    test("the date-based form matches the index-based form", () => {
        for (let day = 1; day <= 30; day++) {
            const date = new Date(2026, 8, day);
            assert.equal(
                isExpectedOnDate(MWF, date),
                isExpectedOn(MWF, idx(2026, 9, day)),
                `Sep ${day}`,
            );
        }
    });
});

describe("expectedDaysBetween", () => {
    test("daily counts every day in the span", () => {
        assert.equal(
            expectedDaysBetween([], idx(2026, 9, 1), idx(2026, 9, 30)),
            30,
        );
    });

    test("Mon/Wed/Fri over a whole September", () => {
        // Sep 2026 has 30 days starting Tue: Mondays 7,14,21,28 (4),
        // Wednesdays 2,9,16,23,30 (5), Fridays 4,11,18,25 (4) = 13.
        assert.equal(
            expectedDaysBetween(MWF, idx(2026, 9, 1), idx(2026, 9, 30)),
            13,
        );
    });

    test("matches a brute-force walk over a long, ragged span", () => {
        const from = idx(2026, 1, 1);
        const to = idx(2026, 12, 31);
        for (const sched of [MWF, [0], [0, 6], [1, 2, 3, 4, 5], [2, 4]]) {
            let brute = 0;
            for (let d = from; d <= to; d++) {
                if (isExpectedOn(sched, d)) brute++;
            }
            assert.equal(
                expectedDaysBetween(sched, from, to),
                brute,
                `schedule ${sched.join(",")}`,
            );
        }
    });

    test("an inverted span is zero, a single day is 0 or 1", () => {
        assert.equal(
            expectedDaysBetween(MWF, idx(2026, 9, 10), idx(2026, 9, 1)),
            0,
        );
        // Sep 7 2026 is a Monday (due); Sep 8 a Tuesday (not).
        assert.equal(
            expectedDaysBetween(MWF, idx(2026, 9, 7), idx(2026, 9, 7)),
            1,
        );
        assert.equal(
            expectedDaysBetween(MWF, idx(2026, 9, 8), idx(2026, 9, 8)),
            0,
        );
    });
});

describe("previousExpected", () => {
    test("a daily habit's previous expected day is itself", () => {
        const d = idx(2026, 9, 8);
        assert.equal(previousExpected([], d), d);
    });

    test("steps back to the most recent scheduled day", () => {
        // Sep 8 2026 is a Tuesday; the previous Mon/Wed/Fri day is Mon Sep 7.
        assert.equal(previousExpected(MWF, idx(2026, 9, 8)), idx(2026, 9, 7));
        // On a scheduled day it returns that day unchanged.
        assert.equal(previousExpected(MWF, idx(2026, 9, 7)), idx(2026, 9, 7));
        // Sunday Sep 6 steps back to Friday Sep 4.
        assert.equal(previousExpected(MWF, idx(2026, 9, 6)), idx(2026, 9, 4));
    });

    test("a once-weekly schedule can step back six days", () => {
        // Only Sundays. Saturday Sep 12 steps back to Sunday Sep 6.
        assert.equal(previousExpected([0], idx(2026, 9, 12)), idx(2026, 9, 6));
    });
});

describe("scheduleLabel", () => {
    test("names the common shapes", () => {
        assert.equal(scheduleLabel([]), "Every day");
        assert.equal(scheduleLabel(undefined), "Every day");
        assert.equal(scheduleLabel([1, 2, 3, 4, 5]), "Weekdays");
        assert.equal(scheduleLabel([0, 6]), "Weekends");
        assert.equal(scheduleLabel([1]), "Mondays");
        assert.equal(scheduleLabel(MWF), "Mon, Wed, Fri");
    });
});
