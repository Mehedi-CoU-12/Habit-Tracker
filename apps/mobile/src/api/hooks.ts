import { useMemo } from "react";
import {
    useMutation,
    useQueries,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import * as api from "./endpoints";
import { ApiDayNote, ApiHabit, UserProfile } from "../lib/types";
import { lastNMonths } from "../lib/date";
import { releasePlatform } from "../lib/version";
import { MonthHabits } from "../lib/deriveStats";
import { isDayComplete, targetOf } from "../lib/completion";
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
                loaded: results[i]?.isSuccess ?? false,
            })),
    });
}

// ── App releases ────────────────────────────────────────────────────────────

export function useAppRelease() {
    const platform = releasePlatform();
    return useQuery({
        queryKey: ["appRelease", platform],
        queryFn: () => api.fetchAppRelease(platform),
        retry: false,
        staleTime: 60 * 60 * 1000,
        refetchOnWindowFocus: true,
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
 *
 * Habits are invalidated alongside the stats because a session bound to a
 * `fillFromFocus` habit writes a HabitLog server-side — without this the ring
 * doesn't move until the next pull-to-refresh.
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
            void runSync().then(async () => {
                await qc.invalidateQueries({ queryKey: ["focusStats"] });
                await qc.invalidateQueries({ queryKey: ["habits"] });
            });
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
            const habit = qc
                .getQueryData<ApiHabit[]>(key)
                ?.find((h) => h.id === habitId);
            const completed = !(habit && isDayComplete(habit, day));

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
                                amount: targetOf(h),
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

export function useSetLogAmount(year: number, month: number) {
    const qc = useQueryClient();
    const key = habitsKey(year, month);
    return useMutation({
        mutationFn: async ({
            habitId,
            day,
            amount,
        }: {
            habitId: string;
            day: number;
            amount: number;
        }) => {
            await qc.cancelQueries({ queryKey: key });
            const next = Math.max(0, Math.round(amount));

            qc.setQueryData<ApiHabit[]>(key, (old = []) =>
                old.map((h) => {
                    if (h.id !== habitId) return h;
                    const logs = h.logs.filter((l) => l.day !== day);
                    if (next === 0) return { ...h, logs };
                    const existing = h.logs.find((l) => l.day === day);
                    return {
                        ...h,
                        logs: [
                            ...logs,
                            {
                                id: existing?.id ?? `local-${habitId}-${day}`,
                                habitId,
                                userId: h.userId,
                                year,
                                month,
                                day,
                                amount: next,
                                createdAt:
                                    existing?.createdAt ??
                                    new Date().toISOString(),
                            },
                        ],
                    };
                }),
            );

            await enqueue({
                kind: "log.amount",
                habitId,
                year,
                month,
                day,
                amount: next,
            });
            void runSync();
            void syncReminders();
            return { amount: next };
        },
    });
}

/**
 * Spend or release one skip on a (habit, date) cell — streak insurance.
 *
 * Optimistic and outbox-backed like the log writes, so a skip spent offline
 * survives a cold start. The allowance check here is a courtesy that keeps the
 * UI honest; the server enforces it, and a refused op is dropped as permanent
 * by the sync worker, which then reconciles the optimistic guess away.
 */
export function useSetSkip(year: number, month: number) {
    const qc = useQueryClient();
    const key = habitsKey(year, month);
    return useMutation({
        mutationFn: async ({
            habitId,
            day,
            used,
        }: {
            habitId: string;
            day: number;
            used: boolean;
        }) => {
            await qc.cancelQueries({ queryKey: key });
            const me = qc.getQueryData<UserProfile>(["me"]);

            qc.setQueryData<ApiHabit[]>(key, (old = []) =>
                old.map((h) => {
                    if (h.id !== habitId) return h;
                    const skips = (h.skips ?? []).filter((s) => s.day !== day);
                    if (!used) return { ...h, skips };
                    return {
                        ...h,
                        skips: [
                            ...skips,
                            {
                                id: `local-skip-${habitId}-${day}`,
                                habitId,
                                userId: h.userId || (me?.id ?? ""),
                                year,
                                month,
                                day,
                                createdAt: new Date().toISOString(),
                            },
                        ].sort((a, b) => a.day - b.day),
                    };
                }),
            );

            await enqueue({ kind: "skip.set", habitId, year, month, day, used });
            void runSync();
            // A forgiven day changes what is still pending today, and the
            // reminder summary counts pending habits.
            void syncReminders();
            return { used };
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
            target?: number | null;
            unit?: string | null;
            step?: number;
            fillFromFocus?: boolean;
            daysOfWeek?: number[];
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
                target: input.target ?? null,
                unit: input.unit ?? null,
                step: input.step ?? 1,
                fillFromFocus: input.fillFromFocus ?? false,
                daysOfWeek: input.daysOfWeek ?? [],
                archivedAt: null,
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
                    target: input.target,
                    unit: input.unit,
                    step: input.step,
                    ...(input.fillFromFocus !== undefined
                        ? { fillFromFocus: input.fillFromFocus }
                        : {}),
                    ...(input.daysOfWeek
                        ? { daysOfWeek: input.daysOfWeek }
                        : {}),
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
            // `archived` is an instruction, not a field: mirror the server's
            // stamping locally so the cache matches what will come back.
            const { archived, ...columns } = patch;
            const archiveFields =
                archived === undefined
                    ? {}
                    : { archivedAt: archived ? now : null };
            qc.setQueriesData<ApiHabit[]>({ queryKey: ["habits"] }, (old) =>
                old?.map((h) =>
                    h.id === id
                        ? { ...h, ...columns, ...archiveFields, updatedAt: now }
                        : h,
                ),
            );
            await enqueue({ kind: "habit.update", id, patch });
            void runSync();
            // Archiving or rescheduling changes which reminders are due.
            void syncReminders();
        },
    });
}

export function dayNotesKey(year: number, month: number) {
    return ["dayNotes", year, month] as const;
}

/** One month of day notes — the window the calendar screen shows. */
export function useDayNotes(year: number, month: number) {
    return useQuery({
        queryKey: dayNotesKey(year, month),
        queryFn: () => api.fetchDayNotes(year, month),
        retry: false,
    });
}

/**
 * Write one day's note. Optimistic and outbox-backed like the log writes, so
 * a note typed offline survives a cold start and lands on reconnect. Blank
 * text clears the day.
 */
export function useSetDayNote(year: number, month: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ day, text }: { day: number; text: string }) => {
            const trimmed = text.trim();
            const now = new Date().toISOString();
            qc.setQueryData<ApiDayNote[]>(dayNotesKey(year, month), (old) => {
                const rest = (old ?? []).filter((n) => n.day !== day);
                if (!trimmed) return rest;
                const existing = old?.find((n) => n.day === day);
                const note: ApiDayNote = {
                    id: existing?.id ?? `local-note-${year}-${month}-${day}`,
                    userId: existing?.userId ?? "",
                    year,
                    month,
                    day,
                    text: trimmed,
                    createdAt: existing?.createdAt ?? now,
                    updatedAt: now,
                };
                return [...rest, note].sort((a, b) => a.day - b.day);
            });

            await enqueue({
                kind: "note.set",
                payload: { year, month, day, text: trimmed },
            });
            void runSync();
            return { day, text: trimmed };
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
