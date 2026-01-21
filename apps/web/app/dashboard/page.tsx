// app/dashboard/page.tsx
"use client";

import { useState } from "react";
import { habits as initialHabits } from "../../src/mock/january";
import DailyLineChart from "../../components/charts/DailyLineChart";
import DonutChart from "../../components/charts/DonutChart";
import WeeklyBarChart from "../../components/charts/WeeklyBarChart";
import HabitGrid from "../../components/habits/HabitGrid";
import MonthSelector from "../../components/MonthSelector";
import TopHabits from "../../components/overview/TopHabits";
import { dailyLogs } from "../../src/mock/dailyLogs";
import { calculateDailyProgress } from "../../src/utils/dailyProgress";
import { calculateWeeklyProgress } from "../../src/utils/weeklyProgress";

const totalHabits = 5;

export type Habit = {
    id: number;
    name: string;
    goal: number;
};

export type HabitLog = {
    habitId: number;
    day: number;
    completed: boolean;
};

export default function DashboardPage() {
    const [habits] = useState<any[]>(initialHabits);
    const [logs, setLogs] = useState<HabitLog[]>([]);

    const completed = habits.reduce((a, b) => a + b.completed, 0);
    const total = habits.reduce((a, b) => a + b.goal, 0);
    const weeklyData = calculateWeeklyProgress(dailyLogs, totalHabits);
    const dailyData = calculateDailyProgress(dailyLogs, totalHabits);

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

    return (
        <div className="p-6 space-y-6">
            <MonthSelector />
            <div className="flex gap-10">
                <DonutChart completed={completed} total={total} />
                <TopHabits habits={habits} />
            </div>
            <div>
                <h2 className="font-bold mb-2">Weekly Progress</h2>
                <WeeklyBarChart data={weeklyData} />
            </div>
            <div>
                <h2 className="font-bold mb-2">Daily Progress</h2>
                <DailyLineChart data={dailyData} />
            </div>
            {/* charts will consume logs */}
            <HabitGrid habits={habits} logs={logs} onToggle={toggleHabit} />
        </div>
    );
}
