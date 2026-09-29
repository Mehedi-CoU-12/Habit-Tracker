import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiHabit, ApiHabitProgress } from "./types";
import { deriveHabitStats } from "./deriveStats";
import {
    claimMilestone,
    liveProgress,
    nextMilestone,
    plantStage,
    reachedMilestones,
} from "./progress";

const today = new Date(2026, 8, 14);

function habit(
    progress: Partial<ApiHabitProgress> | null,
    doneDays: number[] = [],
): ApiHabit {
    return {
        id: "h1",
        name: "Read",
        goal: 20,
        icon: "book",
        tod: "evening",
        verb: null,
        userId: "u1",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        logs: doneDays.map((day) => ({
            id: `l${day}`,
            habitId: "h1",
            userId: "u1",
            year: 2026,
            month: 9,
            day,
            createdAt: "2026-09-01T00:00:00.000Z",
        })),
        progress: progress && {
            asOf: "2026-09-14",
            streak: 0,
            longest: 0,
            freezes: 0,
            frozen: [],
            ...progress,
        },
    };
}

describe("liveProgress", () => {
    test("adds today's completion to the carried streak", () => {
        assert.equal(liveProgress(habit({ streak: 20 }), today)?.streak, 20);
        assert.equal(
            liveProgress(habit({ streak: 20 }, [14]), today)?.streak,
            21,
        );
    });

    test("earns a freeze when today completes a multiple of 7", () => {
        const p = liveProgress(habit({ streak: 13, freezes: 1 }, [14]), today);
        assert.equal(p?.freezes, 2);
        assert.equal(p?.toNextFreeze, 0);
    });

    test("ignores a snapshot from another day", () => {
        const stale = habit({ streak: 5, asOf: "2026-09-13" });
        assert.equal(liveProgress(stale, today), null);
    });

    test("tracks the longest streak including today", () => {
        const p = liveProgress(habit({ streak: 9, longest: 9 }, [14]), today);
        assert.equal(p?.longest, 10);
    });
});

describe("deriveHabitStats with progress", () => {
    test("uses the cross-month streak instead of the month-local one", () => {
        // Only the 13th and 14th are in this month, but the run began in August.
        const h = habit({ streak: 40, longest: 40, freezes: 2 }, [13, 14]);
        const s = deriveHabitStats(h, 2026, 9, 30, today);
        assert.equal(s.streak, 41);
        assert.equal(s.longest, 41);
        assert.equal(s.freezes, 2);
    });

    test("bridges a frozen day in the month-local fallback", () => {
        const h = habit(null, [11, 13, 14]);
        h.progress = {
            asOf: "2026-09-01",
            streak: 0,
            longest: 0,
            freezes: 0,
            frozen: [12],
        };
        const s = deriveHabitStats(h, 2026, 9, 30, today);
        assert.equal(s.streak, 3);
        assert.deepEqual(s.frozenDays, [12]);
    });
});

describe("milestones", () => {
    test("reports reached and next milestones", () => {
        assert.deepEqual(reachedMilestones(31), [7, 30]);
        assert.equal(nextMilestone(31), 100);
        assert.equal(nextMilestone(100), null);
    });

    test("the plant blooms at each milestone", () => {
        assert.deepEqual(
            [0, 1, 6, 7, 29, 30, 99, 100].map(plantStage),
            [0, 1, 2, 3, 3, 4, 4, 5],
        );
    });
});

describe("claimMilestone", () => {
    test("records a habit silently the first time it is seen", () => {
        const seen: Record<string, number> = {};
        assert.equal(claimMilestone(seen, "h1", 45), null);
        assert.equal(seen.h1, 30);
    });

    test("celebrates each new milestone once", () => {
        const seen: Record<string, number> = { h1: 0 };
        assert.equal(claimMilestone(seen, "h1", 6), null);
        assert.equal(claimMilestone(seen, "h1", 7), 7);
        assert.equal(claimMilestone(seen, "h1", 8), null);
        // A broken streak that regrows does not replay the badge.
        assert.equal(claimMilestone(seen, "h1", 7), null);
        assert.equal(claimMilestone(seen, "h1", 30), 30);
    });
});
