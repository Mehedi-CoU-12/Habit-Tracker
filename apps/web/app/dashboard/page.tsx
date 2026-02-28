// app/dashboard/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { habits as initialHabits } from "../../src/mock/january";
import { habitLogs as mockLogs } from "../../src/mock/habitLogs";
import DailyLineChart from "../../components/charts/DailyLineChart";
import DonutChart from "../../components/charts/DonutChart";
import WeeklyOverview from "../../components/overview/WeeklyOverview";
import HabitGrid from "../../components/habits/HabitGrid";
import MonthSelector from "../../components/MonthSelector";
import TopHabits from "../../components/overview/TopHabits";
import { calculateDailyProgress } from "../../src/utils/dailyProgress";
import { calculateWeeklyProgress } from "../../src/utils/weeklyProgress";

export type Habit = {
    id: number;
    name: string;
    goal: number;
};

export type HabitWithStats = Habit & {
    completed: number;
    left: number;
    percent: number;
};

export type HabitLog = {
    habitId: number;
    day: number;
    completed: boolean;
};

export default function DashboardPage() {
    const [logs, setLogs] = useState<HabitLog[]>(mockLogs);

    function toggleHabit(habitId: number, day: number) {
        setLogs((prev) => {
            const exists = prev.find(
                (l) => l.habitId === habitId && l.day === day,
            );
            if (exists) {
                return prev.map((l) =>
                    l === exists ? { ...l, completed: !l.completed } : l,
                );
            }
            return [...prev, { habitId, day, completed: true }];
        });
    }

    // Derive per-habit stats from logs
    const habitsWithStats: HabitWithStats[] = initialHabits.map((h) => {
        const done = logs.filter((l) => l.habitId === h.id && l.completed).length;
        return {
            ...h,
            completed: done,
            left: Math.max(0, h.goal - done),
            percent: Math.round((done / h.goal) * 100),
        };
    });

    const totalCompleted = habitsWithStats.reduce((s, h) => s + h.completed, 0);
    const totalGoal      = habitsWithStats.reduce((s, h) => s + h.goal, 0);

    const dailyData  = calculateDailyProgress(logs, initialHabits.length);
    const weeklyData = calculateWeeklyProgress(logs, initialHabits.length);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top navbar */}
            <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur">
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
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            January 2026
                        </span>
                        <Link
                            href="/login"
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100"
                        >
                            Sign out
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                <MonthSelector />

                {/* Overview row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Weekly table — takes 2 columns */}
                    <div className="lg:col-span-2">
                        <WeeklyOverview
                            data={weeklyData}
                            totalCompleted={totalCompleted}
                            totalGoal={totalGoal}
                        />
                    </div>

                    {/* Right column: donut + top habits */}
                    <div className="flex flex-col gap-6">
                        <DonutChart completed={totalCompleted} total={totalGoal} />
                        <TopHabits habits={habitsWithStats} />
                    </div>
                </div>

                {/* Daily line chart */}
                <DailyLineChart data={dailyData} />

                {/* Habit grid */}
                <HabitGrid habits={habitsWithStats} logs={logs} onToggle={toggleHabit} />
            </div>
        </div>
    );
}
