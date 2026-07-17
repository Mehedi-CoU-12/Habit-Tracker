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
import { syncReminders } from "../notifications";

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

// ── Focus stats ─────────────────────────────────────────────────────────────

export function useFocusStats() {
    return useQuery({
        queryKey: ["focusStats"],
        queryFn: () => {
            const d = new Date();
            return api.fetchFocusStats(
                d.getFullYear(),
                d.getMonth() + 1,
                d.getDate(),
            );
        },
        retry: false,
        staleTime: 60 * 1000,
    });
}

/**
 * Queue a finished focus session through the outbox, so a session completed
 * offline still reaches the dedication history. Stats refresh once the drain
 * actually lands (an immediate invalidate would race the POST).
 */
export function useRecordFocusSession() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            habitId: string | null;
            minutes: number;
        }) => {
            const d = new Date();
            await enqueue({
                kind: "focus.record",
                payload: {
                    id: newId(),
                    habitId: input.habitId,
                    minutes: input.minutes,
                    year: d.getFullYear(),
                    month: d.getMonth() + 1,
                    day: d.getDate(),
                },
            });
            void runSync().then(() =>
                qc.invalidateQueries({ queryKey: ["focusStats"] }),
            );
        },
    });
}

// ── Offline-first mutations ─────────────────────────────────────────────────

export function useToggleLog(year: number, month: number) {
    const qc = useQueryClient();
    const key = habitsKey(year, month);
    return useMutation({
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
            void syncReminders();
            return { completed };
        },
    });
}

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
            // New habit → it should start getting reminders (tod default time).
            void syncReminders();
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
            void syncReminders();
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
            // Deleted habit → drop its pending reminders.
            void syncReminders();
        },
    });
}
