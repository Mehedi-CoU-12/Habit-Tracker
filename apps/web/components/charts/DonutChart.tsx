"use client";

import { PieChart, Pie, Cell } from "recharts";
import OverviewCard from "../overview/OverviewCard";
import { useTheme } from "../../provider/theme";

export default function DonutChart({
    completed,
    total,
}: {
    completed: number;
    total: number;
}) {
    const { theme } = useTheme();
    const left = total - completed;
    const donePercent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const leftPercent = 100 - donePercent;

    const data = [
        { name: "Completed", value: completed },
        { name: "Left", value: Math.max(left, 0) },
    ];

    const leftColor = theme === "dark" ? "#374151" : "#e5e7eb";

    return (
        <OverviewCard title="Overview Daily Progress" bodyClassName="p-4">
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
                            <Cell fill={leftColor} />
                        </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {donePercent}%
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            complete
                        </span>
                    </div>
                </div>

                <div className="mt-2 flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-indigo-500" />
                        <span className="text-gray-600 dark:text-gray-400">
                            Done
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {donePercent}%
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <span className="text-gray-600 dark:text-gray-400">
                            Left
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {leftPercent}%
                        </span>
                    </div>
                </div>

                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {completed} of {total} habit-days completed
                </p>
            </div>
        </OverviewCard>
    );
}
