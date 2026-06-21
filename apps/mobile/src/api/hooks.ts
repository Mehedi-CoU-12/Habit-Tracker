import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./endpoints";
import { ApiHabit } from "../lib/types";

export function useMe() {
    return useQuery({
        queryKey: ["me"],
        queryFn: api.fetchMe,
        retry: false,
        staleTime: 5 * 60 * 1000,
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
