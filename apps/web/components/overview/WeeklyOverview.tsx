"use client";

import OverviewCard from "./OverviewCard";

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
    const globalPercent =
        totalGoal === 0 ? 0 : Math.round((totalCompleted / totalGoal) * 100);

    const rows: {
        label: string;
        getValue: (w: WeekData) => string;
        highlight?: boolean;
    }[] = [
        { label: "Days", getValue: (w) => String(w.days) },
        {
            label: "Day range",
            getValue: (w) =>
                w.dayLabels.slice(0, 3).join(", ") + (w.days > 3 ? "…" : ""),
        },
        {
            label: "Completed",
            getValue: (w) => String(w.completed),
            highlight: true,
        },
        { label: "Goal", getValue: (w) => String(w.goal) },
        { label: "Left", getValue: (w) => String(w.left) },
        { label: "Progress", getValue: (w) => `${w.percent}%` },
    ];

    return (
        <OverviewCard
            title="Overview"
            action={
                <span className="text-xs font-bold text-indigo-700">
                    {totalCompleted}/{totalGoal} &mdash; {globalPercent}%
                </span>
            }
        >
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="w-28 px-5 py-3 text-left font-medium text-gray-500" />
                            {data.map((w) => (
                                <th
                                    key={w.week}
                                    className="px-4 py-3 text-center font-semibold text-indigo-600"
                                >
                                    {w.week}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr
                                key={row.label}
                                className={
                                    ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                                }
                            >
                                <td className="px-5 py-2.5 font-medium text-gray-500">
                                    {row.label}
                                </td>
                                {data.map((w) => (
                                    <td
                                        key={w.week}
                                        className={`tabular-nums px-4 py-2.5 text-center ${
                                            row.highlight
                                                ? "font-semibold text-indigo-700"
                                                : "text-gray-700"
                                        }`}
                                    >
                                        {row.getValue(w)}
                                    </td>
                                ))}
                            </tr>
                        ))}

                        {/* Progress bar row */}
                        <tr className="border-t border-gray-100 bg-white">
                            <td className="px-5 py-3 font-medium text-gray-500">
                                Chart
                            </td>
                            {data.map((w) => (
                                <td key={w.week} className="px-4 py-3">
                                    <div className="flex flex-col items-center gap-1.5">
                                        <div className="h-2 w-full rounded-full bg-gray-100">
                                            <div
                                                className="h-2 rounded-full bg-indigo-500 transition-all"
                                                style={{
                                                    width: `${w.percent}%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {w.percent}%
                                        </span>
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </OverviewCard>
    );
}
