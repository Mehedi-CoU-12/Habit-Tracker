// app/dashboard/page.tsx

import DonutChart from "../../components/charts/DonutChart";
import WeeklyBarChart from "../../components/charts/WeeklyBarChart";
import HabitGrid from "../../components/habits/HabitGrid";
import MonthSelector from "../../components/MonthSelector";
import TopHabits from "../../components/overview/TopHabits";
import { dailyLogs } from "../../src/mock/dailyLogs";
import { habits } from "../../src/mock/january";
import { calculateWeeklyProgress } from "../../src/utils/weeklyProgress";

const totalHabits = 5;

export default function DashboardPage() {
    const completed = habits.reduce((a, b) => a + b.completed, 0);
    const total = habits.reduce((a, b) => a + b.goal, 0);
    const weeklyData = calculateWeeklyProgress(dailyLogs, totalHabits);

    return (
        <div className="p-6 space-y-6">
            <MonthSelector />
            <div className="flex gap-10">
                <DonutChart completed={completed} total={total} />
                <TopHabits habits={habits} />
            </div>
            <HabitGrid habits={habits} />
            <div>
                <h2 className="font-bold mb-2">Weekly Progress</h2>
                <WeeklyBarChart data={weeklyData} />
            </div>
        </div>
    );
}
