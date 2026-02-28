"use client";

type WeekData = {
    week: string;
    days: number;
    dayLabels: string[];
    completed: number;
    goal: number;
    left: number;
    percent: number;
};

export default function WeeklyOverview({
    data,
    totalCompleted,
    totalGoal,
}: {
    data: WeekData[];
    totalCompleted: number;
    totalGoal: number;
}) {
    const globalPercent = totalGoal === 0 ? 0 : Math.round((totalCompleted / totalGoal) * 100);

    const rows: { label: string; getValue: (w: WeekData) => string; highlight?: boolean }[] = [
        { label: "Days",      getValue: (w) => String(w.days) },
        { label: "Day range", getValue: (w) => w.dayLabels.slice(0, 3).join(", ") + (w.days > 3 ? "…" : "") },
        { label: "Completed", getValue: (w) => String(w.completed), highlight: true },
        { label: "Goal",      getValue: (w) => String(w.goal) },
        { label: "Left",      getValue: (w) => String(w.left) },
        { label: "Progress",  getValue: (w) => `${w.percent}%` },
    ];

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Weekly Overview</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="text-left px-5 py-3 font-medium text-gray-500 w-28"></th>
                            {data.map((w) => (
                                <th key={w.week} className="text-center px-4 py-3 font-semibold text-indigo-600">
                                    {w.week}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={row.label} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                <td className="px-5 py-2.5 font-medium text-gray-500">{row.label}</td>
                                {data.map((w) => (
                                    <td
                                        key={w.week}
                                        className={`text-center px-4 py-2.5 tabular-nums ${row.highlight ? "font-semibold text-indigo-700" : "text-gray-700"}`}
                                    >
                                        {row.getValue(w)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {/* Progress bar row */}
                        <tr className="bg-white border-t border-gray-100">
                            <td className="px-5 py-3 font-medium text-gray-500">Chart</td>
                            {data.map((w) => (
                                <td key={w.week} className="px-4 py-3">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-full h-2 rounded-full bg-gray-100">
                                            <div
                                                className="h-2 rounded-full bg-indigo-500 transition-all"
                                                style={{ width: `${w.percent}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Global footer */}
            <div className="px-5 py-3 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                <span className="text-sm font-medium text-indigo-700">Global Progress</span>
                <span className="text-sm font-bold text-indigo-800">
                    {totalCompleted} / {totalGoal} = {globalPercent}%
                </span>
            </div>
        </div>
    );
}
