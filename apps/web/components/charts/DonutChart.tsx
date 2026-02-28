// components/charts/DonutChart.tsx
"use client";

import { PieChart, Pie, Cell } from "recharts";

export default function DonutChart({
    completed,
    total,
}: {
    completed: number;
    total: number;
}) {
    const left = total - completed;
    const donePercent  = total === 0 ? 0 : Math.round((completed / total) * 100);
    const leftPercent  = 100 - donePercent;

    const data = [
        { name: "Completed", value: completed },
        { name: "Left",      value: left },
    ];

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Daily Progress Overview
            </h2>

            <div className="flex flex-col items-center">
                <div className="relative">
                    <PieChart width={180} height={180}>
                        <Pie
                            data={data}
                            cx={90}
                            cy={90}
                            innerRadius={58}
                            outerRadius={80}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            strokeWidth={0}
                        >
                            <Cell fill="#6366f1" />
                            <Cell fill="#e5e7eb" />
                        </Pie>
                    </PieChart>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900">{donePercent}%</span>
                        <span className="text-xs text-gray-400">complete</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-4 flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                        <span className="text-gray-600">Completed</span>
                        <span className="font-semibold text-gray-800">{donePercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />
                        <span className="text-gray-600">Left</span>
                        <span className="font-semibold text-gray-800">{leftPercent}%</span>
                    </div>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                    {completed} of {total} habit-days completed
                </div>
            </div>
        </div>
    );
}
