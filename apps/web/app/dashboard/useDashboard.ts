"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { calculateDailyProgress } from "../../src/utils/dailyProgress";
import { calculateWeeklyProgress } from "../../src/utils/weeklyProgress";
import { deriveHabitStats } from "../../src/lib/deriveStats";
import { amountOn, isDayComplete } from "../../src/lib/completion";
import {
    fetchHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleLog,
    fetchMe,
    applyTemplate,
    logout,
    CreateHabitInput,
} from "../../src/lib/api";
import { toast } from "../../src/lib/toast";
import { ApiHabit, HabitLog, HabitWithStats } from "./types";

/**
 * Owns everything the dashboard needs that isn't markup: the selected month,
 * which modal is open, the habit/profile queries, the derived chart data, and
 * all the mutations. The page component reads from here and only renders.
 */
export function useDashboard() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

    // Which overlay is currently open (only one at a time).
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingHabit, setEditingHabit] = useState<HabitWithStats | null>(
        null,
    );
    const [deletingHabit, setDeletingHabit] = useState<HabitWithStats | null>(
        null,
    );
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);

    const queryKey = ["habits", selectedYear, selectedMonth];

    const { data: me } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    const {
        data: rawHabits = [],
        isLoading,
        isError,
    } = useQuery({
        queryKey,
        queryFn: () => fetchHabits(selectedYear, selectedMonth),
        retry: false,
    });

    const daysInMonth = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).daysInMonth();

    const monthLabel = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).format("MMMM YYYY");

    // An archived habit is retired: off the dashboard, though its logs stay in
    // the database so past months keep their history.
    const liveHabits = (rawHabits as ApiHabit[]).filter((h) => !h.archivedAt);

    // Derive Bloom stats (streak / doneToday / rate …) from the month's logs.
    const habits = liveHabits.map((h) =>
        deriveHabitStats(h, selectedYear, selectedMonth, daysInMonth),
    );

    const logs: HabitLog[] = liveHabits.flatMap((h) =>
        h.logs.map((l) => ({
            habitId: h.id,
            day: l.day,
            completed: isDayComplete(h, l.day),
            amount: amountOn(h, l.day),
        })),
    );

    const totalCompleted = habits.reduce((s, h) => s + h.completed, 0);
    const totalGoal = habits.reduce((s, h) => s + h.goal, 0);

    const dailyData = calculateDailyProgress(logs, habits.length, daysInMonth);
    const weeklyData = calculateWeeklyProgress(
        logs,
        habits.length,
        selectedYear,
        selectedMonth,
    );

    const isCurrentMonth =
        selectedYear === now.getFullYear() &&
        selectedMonth === now.getMonth() + 1;
    const todayDate = now.getDate();

    // --- Mutations ---

    const toggleMutation = useMutation({
        mutationFn: ({ habitId, day }: { habitId: string; day: number }) =>
            toggleLog(habitId, selectedYear, selectedMonth, day),
        onMutate: async ({ habitId, day }) => {
            await queryClient.cancelQueries({ queryKey });
            const prev = queryClient.getQueryData<ApiHabit[]>(queryKey);
            queryClient.setQueryData<ApiHabit[]>(queryKey, (old = []) =>
                old.map((habit) => {
                    if (habit.id !== habitId) return habit;
                    const logIdx = habit.logs.findIndex((l) => l.day === day);
                    if (logIdx >= 0) {
                        return {
                            ...habit,
                            logs: habit.logs.filter((_, i) => i !== logIdx),
                        };
                    }
                    const optimistic = {
                        id: "temp",
                        habitId,
                        userId: "",
                        year: selectedYear,
                        month: selectedMonth,
                        day,
                        createdAt: "",
                    };
                    return { ...habit, logs: [...habit.logs, optimistic] };
                }),
            );
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey }),
    });

    const createMutation = useMutation({
        mutationFn: (input: CreateHabitInput) => createHabit(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setShowAddModal(false);
            toast.success("New habit planted 🌱");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, input }: { id: string; input: CreateHabitInput }) =>
            updateHabit(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setEditingHabit(null);
            toast.success("Habit updated");
        },
    });

    const templateMutation = useMutation({
        mutationFn: (templateId: string) => applyTemplate(templateId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey });
            setShowTemplatesModal(false);
            toast.success(
                `Added ${data.created} habit${data.created === 1 ? "" : "s"}`,
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (habitId: string) => deleteHabit(habitId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setDeletingHabit(null);
            toast.success("Habit removed");
        },
    });

    async function handleSignOut() {
        await logout(); // revoke server-side (all sessions) + clear local tokens
        queryClient.removeQueries({ queryKey: ["me"] });
        router.push("/");
    }

    return {
        // profile
        me,

        // month selection
        selectedYear,
        selectedMonth,
        setSelectedYear,
        setSelectedMonth,

        // query status
        isLoading,
        isError,

        // derived data
        habits,
        logs,
        daysInMonth,
        monthLabel,
        totalCompleted,
        totalGoal,
        dailyData,
        weeklyData,
        isCurrentMonth,
        todayDate,

        // modal state
        showAddModal,
        setShowAddModal,
        editingHabit,
        setEditingHabit,
        deletingHabit,
        setDeletingHabit,
        showTemplatesModal,
        setShowTemplatesModal,

        // mutations
        toggleMutation,
        createMutation,
        updateMutation,
        templateMutation,
        deleteMutation,

        // actions
        handleSignOut,
    };
}
