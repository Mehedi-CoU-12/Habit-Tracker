import { useMemo } from "react";
import {
    useMutation,
    useQueries,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import * as api from "./endpoints";
import { ApiHabit, UserProfile } from "../lib/types";
import { lastNMonths } from "../lib/date";
import { MonthHabits } from "../lib/deriveStats";
import { newId } from "../offline/ids";
import { enqueue, type HabitPatch } from "../offline/outbox";
import { runSync } from "../offline/sync";

// Strip undefined keys so a merged patch / optimistic spread never blanks a
// field that wasn't actually edited.
function definedOnly<T extends object>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    for (const k in obj) {
        if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
}

export function useMe(enabled = true) {
    return useQuery({
        queryKey: ["me"],
        queryFn: api.fetchMe,
        retry: false,
        staleTime: 5 * 60 * 1000,
        // The AuthGate disables this until a token exists, so signed-out
        // visitors don't fire a guaranteed-401 request on the login screen.
        enabled,
    });
}

export function useUploadAvatar() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.uploadAvatar,
        onSuccess: (updated) => qc.setQueryData<UserProfile>(["me"], updated),
    });
}

export function habitsKey(year: number, month: number) {
    return ["habits", year, month] as const;
}

export function useHabits(year: number, month: number) {
    return useQuery({
        queryKey: habitsKey(year, month),
        queryFn: () => api.fetchHabits(year, month),
        retry: false,
    });
}

/**
 * Fetch the trailing `monthsBack` months of habit logs in parallel, reusing the
 * per-month `habitsKey` cache so the current month is shared with `useHabits`
 * and a completion toggle refreshes the heatmaps too. 7 months (not 6) ensures
 * the leftmost week-column of the 26-week grid always has data. Returns one
 * entry per month for the heatmap builders in `deriveStats`.
 */
export function useHabitsHistory(today: Date, monthsBack = 7): MonthHabits[] {
    const months = useMemo(
        () => lastNMonths(today, monthsBack),
        [today, monthsBack],
    );
    // `combine` assembles the result so useQueries returns a referentially
    // stable value (via replaceEqualDeep) — without it useQueries hands back a
    // fresh array every render, which would defeat the downstream heatmap memos.
    return useQueries({
        queries: months.map(({ year, month }) => ({
            queryKey: habitsKey(year, month),
            queryFn: () => api.fetchHabits(year, month),
            retry: false,
            staleTime: 5 * 60 * 1000,
        })),
        combine: (results) =>
            months.map((m, i) => ({
                year: m.year,
                month: m.month,
                habits: results[i]?.data ?? [],
            })),
    });
}

// ── Offline-first mutations ─────────────────────────────────────────────────
// Every write is applied optimistically to the React Query cache and appended
// to the durable outbox; the sync worker sends it to the server (now, if
// online) and reconciles. mutationFn therefore never touches the network — it
// resolves as soon as the op is queued, so existing `onSuccess` callbacks (e.g.
// closing the add-habit modal) still fire and the UI stays instant offline.

export function useToggleLog(year: number, month: number) {
    const qc = useQueryClient();
    const key = habitsKey(year, month);
    return useMutation({
        // Named "toggle" for its call sites, but implemented as an absolute set:
        // the desired state is derived from the cache, then sent as a boolean so
        // replays are idempotent.
        mutationFn: async ({
            habitId,
            day,
        }: {
            habitId: string;
            day: number;
        }) => {
            await qc.cancelQueries({ queryKey: key });
            const list = qc.getQueryData<ApiHabit[]>(key);
            const has = !!list
                ?.find((h) => h.id === habitId)
                ?.logs.some((l) => l.day === day);
            const completed = !has;

            qc.setQueryData<ApiHabit[]>(key, (old = []) =>
                old.map((h) => {
                    if (h.id !== habitId) return h;
                    const logs = h.logs.filter((l) => l.day !== day);
                    if (!completed) return { ...h, logs };
                    return {
                        ...h,
                        logs: [
                            ...logs,
                            {
                                id: `local-${habitId}-${day}`,
                                habitId,
                                userId: h.userId,
                                year,
                                month,
                                day,
                                createdAt: new Date().toISOString(),
                            },
                        ],
                    };
                }),
            );

            await enqueue({
                kind: "log.set",
                habitId,
                year,
                month,
                day,
                completed,
            });
            void runSync();
            return { completed };
        },
    });
}

// year/month are kept for a stable call-site signature; the optimistic write
// now spans every cached month, so they're not read here.
export function useCreateHabit(_year: number, _month: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            name: string;
            goal: number;
            icon?: string;
            tod?: string;
            verb?: string;
        }) => {
            const id = newId();
            const now = new Date().toISOString();
            const me = qc.getQueryData<UserProfile>(["me"]);
            const optimistic: ApiHabit = {
                id,
                name: input.name,
                goal: input.goal,
                icon: input.icon ?? "sprout",
                tod: input.tod ?? "anytime",
                verb: input.verb ?? null,
                userId: me?.id ?? "",
                createdAt: now,
                updatedAt: now,
                logs: [],
            };
            // A habit appears in every month's list (only its logs are
            // month-scoped), so insert it into all cached month queries.
            qc.setQueriesData<ApiHabit[]>({ queryKey: ["habits"] }, (old) =>
                old ? [...old, optimistic] : old,
            );
            await enqueue({
                kind: "habit.create",
                payload: {
                    id,
                    name: input.name,
                    goal: input.goal,
                    icon: input.icon,
                    tod: input.tod,
                    verb: input.verb,
                },
            });
            void runSync();
            return optimistic;
        },
    });
}

export function useUpdateHabit(_year: number, _month: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({
            id,
            input,
        }: {
            id: string;
            input: HabitPatch;
        }) => {
            const patch = definedOnly(input);
            const now = new Date().toISOString();
            qc.setQueriesData<ApiHabit[]>({ queryKey: ["habits"] }, (old) =>
                old?.map((h) =>
                    h.id === id ? { ...h, ...patch, updatedAt: now } : h,
                ),
            );
            await enqueue({ kind: "habit.update", id, patch });
            void runSync();
        },
    });
}

export function useDeleteHabit(_year: number, _month: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            qc.setQueriesData<ApiHabit[]>({ queryKey: ["habits"] }, (old) =>
                old?.filter((h) => h.id !== id),
            );
            await enqueue({ kind: "habit.delete", id });
            void runSync();
        },
    });
}
