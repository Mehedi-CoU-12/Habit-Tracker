"use client";

import { useEffect, useState } from "react";
import type { ApiHabit } from "../../app/dashboard/types";
import { claimMilestone, liveProgress } from "./progress";

const KEY = "habitflow.milestones.v1";

function load(): Record<string, number> {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {
        return {};
    }
}

/** The newest milestone reached in `habits`, until dismissed. */
export function useMilestoneCelebration(habits: ApiHabit[], enabled: boolean) {
    const [hit, setHit] = useState<{ name: string; days: number } | null>(null);

    useEffect(() => {
        if (!enabled || habits.length === 0) return;
        const seen = load();
        const before = JSON.stringify(seen);
        const today = new Date();
        let found: { name: string; days: number } | null = null;
        for (const h of habits) {
            if (h.archivedAt) continue;
            const live = liveProgress(h, today);
            if (!live) continue;
            const days = claimMilestone(seen, h.id, live.streak);
            if (days && !found) found = { name: h.name, days };
        }
        if (JSON.stringify(seen) !== before) {
            try {
                localStorage.setItem(KEY, JSON.stringify(seen));
            } catch {
                /* storage full or blocked — a celebration may repeat */
            }
        }
        if (found) setHit(found);
    }, [habits, enabled]);

    return { hit, dismiss: () => setHit(null) };
}
