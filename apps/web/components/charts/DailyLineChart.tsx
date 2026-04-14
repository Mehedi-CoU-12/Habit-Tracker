"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
} from "recharts";
import OverviewCard from "../overview/OverviewCard";
import { useTheme } from "../../provider/theme";

function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: { value: number }[];
    label?: number;
}) {
    if (!active || !payload || payload.length === 0) return null;
    const value = payload[0]!.value;
    return (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-md text-xs">
            <p className="font-medium text-gray-700 dark:text-gray-300">Day {label}</p>
            <p className="text-indigo-600 dark:text-indigo-400 font-bold">{value}%</p>
        </div>
    );
}

export default function DailyLineChart({
    data,
    monthLabel,
}: {
    data: { day: number; percent: number }[];
    monthLabel: string;
}) {
    const { theme } = useTheme();
    const gridColor = theme === "dark" ? "#374151" : "#f3f4f6";
    const tickColor = theme === "dark" ? "#6b7280" : "#9ca3af";

    return (
        <OverviewCard title={`Daily Progress — ${monthLabel}`} bodyClassName="p-5">
            <div className="w-full h-56">
                <ResponsiveContainer>
                    <LineChart
                        data={data}
                        margin={{ top: 4, right: 16, left: -10, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={gridColor}
                        />
                        <XAxis
                            dataKey="day"
                            tick={{ fontSize: 11, fill: tickColor }}
                            tickLine={false}
                            axisLine={false}
                            ticks={[1, 5, 10, 15, 20, 25, 31]}
                        />
                        <YAxis
                            domain={[0, 110]}
                            tick={{ fontSize: 11, fill: tickColor }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine
                            y={100}
                            stroke={gridColor}
                            strokeDasharray="4 4"
                        />
                        <Line
                            type="monotone"
                            dataKey="percent"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{
                                r: 4,
                                fill: "#6366f1",
                                strokeWidth: 0,
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </OverviewCard>
    );
}
