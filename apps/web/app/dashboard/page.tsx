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
import Image from "next/image";
import { fetchHabits, createHabit, deleteHabit, toggleLog, fetchMe } from "../../src/lib/api";
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
        if (!name.trim()) { setError("Name is required"); return; }
        if (goal < 1 || goal > 31) { setError("Goal must be between 1 and 31"); return; }
        onAdd(name.trim(), goal);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-gray-900">New habit</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Habit name
                        </label>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Morning Run"
                            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Monthly goal <span className="text-gray-400 font-normal">(days)</span>
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={31}
                            value={goal}
                            onChange={(e) => setGoal(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
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

    const [showUserMenu, setShowUserMenu] = useState(false);
    const queryKey = ["habits", selectedYear, selectedMonth];

    const { data: me } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    const { data: rawHabits = [], isLoading, isError } = useQuery({
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
    const weeklyData = calculateWeeklyProgress(logs, habits.length, selectedYear, selectedMonth);

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
                        return { ...habit, logs: habit.logs.filter((_, i) => i !== logIdx) };
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

    const deleteMutation = useMutation({
        mutationFn: (habitId: string) => deleteHabit(habitId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    function handleSignOut() {
        localStorage.removeItem("accessToken");
        router.push("/login");
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {showAddModal && (
                <AddHabitModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={(name, goal) => createMutation.mutate({ name, goal })}
                />
            )}

            {/* Top navbar */}
            <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-900">HabitFlow</span>
                    </Link>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add habit
                        </button>

                        {/* User menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu((v) => !v)}
                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-100"
                            >
                                {me?.avatarUrl ? (
                                    <Image
                                        src={me.avatarUrl}
                                        alt={me.name}
                                        width={28}
                                        height={28}
                                        className="h-7 w-7 rounded-full object-cover ring-2 ring-indigo-100"
                                    />
                                ) : (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                                        {me?.name?.[0]?.toUpperCase() ?? "?"}
                                    </div>
                                )}
                                <span className="hidden sm:block text-xs font-medium text-gray-700 max-w-24 truncate">
                                    {me?.name ?? ""}
                                </span>
                                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showUserMenu && (
                                <>
                                    {/* Backdrop */}
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    {/* Dropdown */}
                                    <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-xl border border-gray-200 bg-white shadow-lg py-1.5">
                                        <div className="px-3 py-2 border-b border-gray-100">
                                            <p className="text-xs font-semibold text-gray-900 truncate">{me?.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{me?.email}</p>
                                        </div>
                                        <Link
                                            href="/profile"
                                            onClick={() => setShowUserMenu(false)}
                                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition"
                                        >
                                            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Profile &amp; settings
                                        </Link>
                                        <button
                                            onClick={handleSignOut}
                                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            Sign out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

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
                            Could not load habits. Make sure the API is running and you are signed in.
                        </p>
                        <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                            Sign in again →
                        </Link>
                    </div>
                )}

                {!isLoading && !isError && (
                    <>
                        {/* Overview row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <WeeklyOverview
                                    data={weeklyData}
                                    totalCompleted={totalCompleted}
                                    totalGoal={totalGoal}
                                />
                            </div>
                            <div className="flex flex-col gap-6">
                                <DonutChart completed={totalCompleted} total={totalGoal} />
                                <TopHabits habits={habits} />
                            </div>
                        </div>

                        {/* Daily line chart */}
                        <DailyLineChart data={dailyData} />

                        {/* Habit grid */}
                        <HabitGrid
                            habits={habits}
                            logs={logs}
                            daysInMonth={daysInMonth}
                            monthLabel={monthLabel}
                            year={selectedYear}
                            month={selectedMonth}
                            onToggle={(habitId, day) => toggleMutation.mutate({ habitId, day })}
                            onDelete={(habitId) => deleteMutation.mutate(habitId)}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
