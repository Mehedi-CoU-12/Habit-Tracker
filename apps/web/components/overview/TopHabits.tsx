import { HabitWithStats } from "../../app/dashboard/types";
import { IconTrophy } from "../icons/Icon";
import OverviewCard from "./OverviewCard";

function rankColor(i: number) {
    if (i === 0) return "text-amber-400";
    if (i === 1) return "text-gray-400";
    if (i === 2) return "text-orange-500";
    return "text-gray-400 dark:text-gray-500";
}

function percentColor(i: number) {
    if (i === 0) return "text-amber-500";
    if (i === 1) return "text-gray-400";
    if (i === 2) return "text-orange-500";
    return "text-indigo-600 dark:text-indigo-400";
}

function barColor(percent: number) {
    if (percent >= 50) return "bg-emerald-500";
    if (percent >= 20) return "bg-amber-500";
    return "bg-indigo-500";
}

export default function TopHabits({ habits }: { habits: HabitWithStats[] }) {
    const sorted = [...habits].sort((a, b) => b.percent - a.percent);

    return (
        <OverviewCard
            title="Top 10 Daily Habits"
            className="h-full"
            bodyClassName="flex-1 min-h-0 overflow-y-auto p-5 pr-3"
        >
            {sorted.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
                    <IconTrophy className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <div>
                        <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                            No habits yet
                        </p>
                        <p className="mt-0.5 text-xs text-gray-300 dark:text-gray-600">
                            Add habits to see your top performers
                        </p>
                    </div>
                </div>
            ) : (
                <ol className="space-y-3">
                    {sorted.slice(0, 10).map((h, i) => (
                        <li
                            key={h.id}
                            className={`flex items-center gap-3 ${
                                i === 0
                                    ? "-mx-2 rounded-lg bg-amber-50/60 px-2 py-1 dark:bg-amber-900/10"
                                    : ""
                            }`}
                        >
                            <span
                                className={`w-5 shrink-0 text-right text-xs font-bold ${rankColor(i)}`}
                            >
                                {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                                        {h.name}
                                    </span>
                                    <span
                                        className={`ml-2 shrink-0 text-xs font-semibold ${percentColor(i)}`}
                                    >
                                        {h.percent}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                                    <div
                                        className={`h-1.5 rounded-full transition-all ${barColor(h.percent)}`}
                                        style={{ width: `${h.percent}%` }}
                                    />
                                </div>
                            </div>
                            <span className="w-14 shrink-0 text-right text-xs text-gray-400 dark:text-gray-500">
                                {h.completed}/{h.goal}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </OverviewCard>
    );
}
