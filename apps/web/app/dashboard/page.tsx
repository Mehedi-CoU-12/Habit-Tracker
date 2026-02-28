// app/dashboard/page.tsx
"use client";

import { useState } from "react";
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
            <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">
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
