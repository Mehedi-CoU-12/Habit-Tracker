"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import DailyLineChart from "../../components/charts/DailyLineChart";
import DonutChart from "../../components/charts/DonutChart";
import WeeklyOverview from "../../components/overview/WeeklyOverview";
import HabitGrid from "../../components/habits/HabitGrid";
import MonthSelector from "../../components/MonthSelector";
import TopHabits from "../../components/overview/TopHabits";
import { calculateDailyProgress } from "../../src/utils/dailyProgress";
import { calculateWeeklyProgress } from "../../src/utils/weeklyProgress";
import {
    fetchHabits,
    createHabit,
    deleteHabit,
    toggleLog,
    fetchMe,
    applyTemplate,
} from "../../src/lib/api";
import TemplatesModal from "../../components/habits/TemplatesModal";
import Navbar from "../../components/layout/Navbar";
import { IconClose } from "../../components/icons/Icon";
import { ApiHabit, HabitLog, HabitWithStats } from "./types";

function AddHabitModal({
    onClose,
    onAdd,
}: {
    onClose: () => void;
    onAdd: (name: string, goal: number) => void;
}) {
    const [name, setName] = useState("");
    const [goal, setGoal] = useState(30);
    const [error, setError] = useState("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setError("Name is required");
            return;
        }
        if (goal < 1 || goal > 31) {
            setError("Goal must be between 1 and 31");
            return;
        }
        onAdd(name.trim(), goal);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        New habit
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
                        aria-label="Close"
                    >
                        <IconClose />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Habit name
                        </label>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Morning Run"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Monthly goal{" "}
                            <span className="text-gray-400 dark:text-gray-500 font-normal">
                                (days)
                            </span>
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={31}
                            value={goal}
                            onChange={(e) => setGoal(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
                        >
                            Add habit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [showAddModal, setShowAddModal] = useState(false);
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

    // Derive flat types from API response
    const habits: HabitWithStats[] = (rawHabits as ApiHabit[]).map((h) => {
        const done = h.logs.length;
        return {
            id: h.id,
            name: h.name,
            goal: h.goal,
            completed: done,
            left: Math.max(0, h.goal - done),
            percent: h.goal === 0 ? 0 : Math.round((done / h.goal) * 100),
        };
    });

    const logs: HabitLog[] = (rawHabits as ApiHabit[]).flatMap((h) =>
        h.logs.map((l) => ({ habitId: h.id, day: l.day, completed: true })),
    );

    const daysInMonth = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).daysInMonth();

    const monthLabel = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).format("MMMM YYYY");

    const totalCompleted = habits.reduce((s, h) => s + h.completed, 0);
    const totalGoal = habits.reduce((s, h) => s + h.goal, 0);

    const dailyData = calculateDailyProgress(logs, habits.length, daysInMonth);
    const weeklyData = calculateWeeklyProgress(
        logs,
        habits.length,
        selectedYear,
        selectedMonth,
    );

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
        mutationFn: ({ name, goal }: { name: string; goal: number }) =>
            createHabit(name, goal),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setShowAddModal(false);
        },
    });

    const templateMutation = useMutation({
        mutationFn: (templateId: string) => applyTemplate(templateId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setShowTemplatesModal(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (habitId: string) => deleteHabit(habitId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    function handleSignOut() {
        localStorage.removeItem("accessToken");
        queryClient.removeQueries({ queryKey: ["me"] });
        router.push("/");
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {showAddModal && (
                <AddHabitModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={(name, goal) =>
                        createMutation.mutate({ name, goal })
                    }
                />
            )}

            {showTemplatesModal && (
                <TemplatesModal
                    onClose={() => setShowTemplatesModal(false)}
                    onApply={(templateId) =>
                        templateMutation.mutate(templateId)
                    }
                    loading={templateMutation.isPending}
                />
            )}

            <Navbar
                variant="dashboard"
                me={me} 
                onAddHabit={() => setShowAddModal(true)}
                onShowTemplates={() => setShowTemplatesModal(true)}
                onSignOut={handleSignOut}
            />

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                <MonthSelector
                    year={selectedYear}
                    month={selectedMonth}
                    onYearChange={setSelectedYear}
                    onMonthChange={setSelectedMonth}
                />

                {isLoading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    </div>
                )}

                {isError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
                        <p className="text-sm font-medium text-red-600">
                            Could not load habits. Make sure the API is running
                            and you are signed in.
                        </p>
                        <Link
                            href="/login"
                            className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                            Sign in again →
                        </Link>
                    </div>
                )}

                {!isLoading && !isError && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* ── Main column ── */}
                        <div className="lg:col-span-3 space-y-6">
                            <DailyLineChart
                                data={dailyData}
                                monthLabel={monthLabel}
                            />
                            <WeeklyOverview
                                data={weeklyData}
                                totalCompleted={totalCompleted}
                                totalGoal={totalGoal}
                            />
                            <HabitGrid
                                habits={habits}
                                logs={logs}
                                daysInMonth={daysInMonth}
                                monthLabel={monthLabel}
                                year={selectedYear}
                                month={selectedMonth}
                                onToggle={(habitId, day) =>
                                    toggleMutation.mutate({ habitId, day })
                                }
                                onDelete={(habitId) =>
                                    deleteMutation.mutate(habitId)
                                }
                            />
                        </div>

                        {/* ── Sidebar ── */}
                        <div className="flex flex-col gap-6">
                            <DonutChart
                                completed={totalCompleted}
                                total={totalGoal}
                            />
                            <TopHabits habits={habits} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
