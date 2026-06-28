"use client";

import DailyLineChart from "../charts/DailyLineChart";
import DonutChart from "../charts/DonutChart";
import WeeklyOverview from "../overview/WeeklyOverview";
import TopHabits from "../overview/TopHabits";
import HabitGrid from "../habits/HabitGrid";
import Garden from "../habits/Garden";
import { useBloom } from "../../provider/theme";
import { HabitWithStats, HabitLog } from "../../app/dashboard/types";
import { calculateDailyProgress } from "../../src/utils/dailyProgress";
import { calculateWeeklyProgress } from "../../src/utils/weeklyProgress";

type DailyData = ReturnType<typeof calculateDailyProgress>;
type WeeklyData = ReturnType<typeof calculateWeeklyProgress>;

/**
 * The dashboard body shown once habits have loaded: the signature garden view,
 * the chart rows, and the full month habit grid. Purely presentational — every
 * action is delegated back to the page through the callbacks.
 */
export default function DashboardContent({
    habits,
    logs,
    daysInMonth,
    monthLabel,
    year,
    month,
    totalCompleted,
    totalGoal,
    dailyData,
    weeklyData,
    onToggle,
    onToggleToday,
    onEdit,
    onDelete,
}: {
    habits: HabitWithStats[];
    logs: HabitLog[];
    daysInMonth: number;
    monthLabel: string;
    year: number;
    month: number;
    totalCompleted: number;
    totalGoal: number;
    dailyData: DailyData;
    weeklyData: WeeklyData;
    onToggle: (habitId: string, day: number) => void;
    onToggleToday: (habitId: string) => void;
    onEdit: (habit: HabitWithStats) => void;
    onDelete: (habit: HabitWithStats) => void;
}) {
    const { layout } = useBloom();

    return (
        <div className="space-y-6">
            {/* ── Garden (signature view) ── */}
            {layout === "garden" && (
                <Garden habits={habits} onToggleToday={onToggleToday} />
            )}

            {/* ── Row 1: Line chart + Donut ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="lg:col-span-3">
                    <DailyLineChart data={dailyData} monthLabel={monthLabel} />
                </div>
                <DonutChart completed={totalCompleted} total={totalGoal} />
            </div>

            {/* ── Row 2: Weekly overview + Top habits ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="lg:col-span-3">
                    <WeeklyOverview
                        data={weeklyData}
                        totalCompleted={totalCompleted}
                        totalGoal={totalGoal}
                    />
                </div>
                <div className="lg:relative">
                    <div className="lg:absolute lg:inset-0">
                        <TopHabits habits={habits} />
                    </div>
                </div>
            </div>

            {/* ── Full-width habit grid ── */}
            <HabitGrid
                habits={habits}
                logs={logs}
                daysInMonth={daysInMonth}
                monthLabel={monthLabel}
                year={year}
                month={month}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
            />
        </div>
    );
}
