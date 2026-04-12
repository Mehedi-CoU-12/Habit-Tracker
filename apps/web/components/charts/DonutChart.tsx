"use client";

import { PieChart, Pie, Cell } from "recharts";
import OverviewCard from "../overview/OverviewCard";

export default function DonutChart({
    completed,
    total,
}: {
    completed: number;
    total: number;
}) {
    const left = total - completed;
    const donePercent =
        total === 0 ? 0 : Math.round((completed / total) * 100);
    const leftPercent = 100 - donePercent;

    const data = [
        { name: "Completed", value: completed },
        { name: "Left", value: Math.max(left, 0) },
    ];

    return (
        <OverviewCard title="Overview Daily Progress" bodyClassName="p-5">
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900">
                            {donePercent}%
                        </span>
                        <span className="text-xs text-gray-400">complete</span>
                    </div>
                </div>

                <div className="mt-4 flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-indigo-500" />
                        <span className="text-gray-600">Done</span>
                        <span className="font-semibold text-gray-800">
                            {donePercent}%
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-gray-200" />
                        <span className="text-gray-600">Left</span>
                        <span className="font-semibold text-gray-800">
                            {leftPercent}%
                        </span>
                    </div>
                </div>

                <p className="mt-3 text-xs text-gray-400">
                    {completed} of {total} habit-days completed
                </p>
            </div>
        </OverviewCard>
    );
}
