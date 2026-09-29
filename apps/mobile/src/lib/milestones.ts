import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import type { ApiHabit } from "./types";
import { claimMilestone, liveProgress } from "./progress";

const KEY = "habitflow.milestones.v1";

/** habitId → highest milestone already celebrated (0 = none yet). */
let seen: Record<string, number> | null = null;

async function load(): Promise<Record<string, number>> {
    if (seen) return seen;
    try {
        const raw = await AsyncStorage.getItem(KEY);
        seen = raw ? JSON.parse(raw) : {};
    } catch {
        seen = {};
    }
    return seen!;
}

function save() {
    AsyncStorage.setItem(KEY, JSON.stringify(seen)).catch(() => {});
}

/** Forget every celebration, e.g. on sign-out. */
export async function clearMilestones(): Promise<void> {
    seen = {};
    await AsyncStorage.removeItem(KEY).catch(() => {});
}

/** Opens the celebration screen when a habit's streak reaches a new milestone. */
export function useMilestoneCelebration(habits: ApiHabit[]) {
    const router = useRouter();
    useEffect(() => {
        let cancelled = false;
        void load().then((store) => {
            if (cancelled) return;
            const today = new Date();
            let dirty = false;
            let hit: { id: string; days: number } | null = null;
            for (const h of habits) {
                if (h.archivedAt) continue;
                const live = liveProgress(h, today);
                if (!live) continue;
                const before = store[h.id];
                const days = claimMilestone(store, h.id, live.streak);
                if (store[h.id] !== before) dirty = true;
                if (days && !hit) hit = { id: h.id, days };
            }
            if (dirty) save();
            if (hit)
                router.push({
                    pathname: "/milestone",
                    params: { id: hit.id, days: String(hit.days) },
                });
        });
        return () => {
            cancelled = true;
        };
    }, [habits, router]);
}
