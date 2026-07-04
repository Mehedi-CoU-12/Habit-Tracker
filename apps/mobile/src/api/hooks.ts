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

export function useToggleLog(year: number, month: number) {
    const qc = useQueryClient();
    const key = habitsKey(year, month);
    return useMutation({
        mutationFn: ({ habitId, day }: { habitId: string; day: number }) =>
            api.toggleLog(habitId, year, month, day),
        onMutate: async ({ habitId, day }) => {
            await qc.cancelQueries({ queryKey: key });
            const prev = qc.getQueryData<ApiHabit[]>(key);
            qc.setQueryData<ApiHabit[]>(key, (old = []) =>
                old.map((h) => {
                    if (h.id !== habitId) return h;
                    const idx = h.logs.findIndex((l) => l.day === day);
                    if (idx >= 0) {
                        return {
                            ...h,
                            logs: h.logs.filter((_, i) => i !== idx),
                        };
                    }
                    return {
                        ...h,
                        logs: [
                            ...h.logs,
                            {
                                id: "temp",
                                habitId,
                                userId: "",
                                year,
                                month,
                                day,
                                createdAt: "",
                            },
                        ],
                    };
                }),
            );
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) qc.setQueryData(key, ctx.prev);
        },
        onSettled: () => qc.invalidateQueries({ queryKey: key }),
    });
}

export function useCreateHabit(year: number, month: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: api.createHabit,
        onSuccess: () =>
            qc.invalidateQueries({ queryKey: habitsKey(year, month) }),
    });
}

export function useUpdateHabit(year: number, month: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            id: string;
            input: Parameters<typeof api.updateHabit>[1];
        }) => api.updateHabit(id, input),
        onSuccess: () =>
            qc.invalidateQueries({ queryKey: habitsKey(year, month) }),
    });
}

export function useDeleteHabit(year: number, month: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.deleteHabit(id),
        onSuccess: () =>
            qc.invalidateQueries({ queryKey: habitsKey(year, month) }),
    });
}
