import { HabitWithStats } from "../../app/dashboard/types";
import OverviewCard from "./OverviewCard";

export default function TopHabits({ habits }: { habits: HabitWithStats[] }) {
    const sorted = [...habits].sort((a, b) => b.percent - a.percent);

    return (
        <OverviewCard title="Top 10 Daily Habits" bodyClassName="p-5">
            {sorted.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                    No habits yet.
                </p>
            ) : (
                <ol className="space-y-3">
                    {sorted.slice(0, 10).map((h, i) => (
                        <li key={h.id} className="flex items-center gap-3">
                            <span className="w-5 shrink-0 text-right text-xs font-bold text-gray-400 dark:text-gray-500">
                                {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                                        {h.name}
                                    </span>
                                    <span className="ml-2 shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                        {h.percent}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                                    <div
                                        className="h-1.5 rounded-full bg-indigo-500 transition-all"
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
