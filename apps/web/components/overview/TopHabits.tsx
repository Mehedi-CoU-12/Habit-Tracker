// components/overview/TopHabits.tsx
type HabitWithStats = {
    id: number;
    name: string;
    goal: number;
    completed: number;
    percent: number;
};

export default function TopHabits({ habits }: { habits: HabitWithStats[] }) {
    const sorted = [...habits].sort((a, b) => b.percent - a.percent);

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Top 10 Daily Habits
            </h2>

            <ol className="space-y-3">
                {sorted.slice(0, 10).map((h, i) => (
                    <li key={h.id} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-gray-400 text-right flex-shrink-0">
                            {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-700 truncate">{h.name}</span>
                                <span className="text-xs font-semibold text-indigo-600 ml-2 flex-shrink-0">
                                    {h.percent}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-gray-100">
                                <div
                                    className="h-1.5 rounded-full bg-indigo-500 transition-all"
                                    style={{ width: `${h.percent}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 w-14 text-right">
                            {h.completed}/{h.goal}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
