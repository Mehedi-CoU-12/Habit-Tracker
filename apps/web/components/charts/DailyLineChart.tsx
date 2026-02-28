// components/charts/DailyLineChart.tsx
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

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: number }) {
    if (!active || !payload || payload.length === 0) return null;
    const value = payload[0]!.value;
    return (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-xs">
            <p className="font-medium text-gray-700">Day {label}</p>
            <p className="text-indigo-600 font-bold">{value}%</p>
        </div>
    );
}

export default function DailyLineChart({
    data,
}: {
    data: { day: number; percent: number }[];
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Daily Progress — January 2026
            </h2>
            <div className="w-full h-56">
                <ResponsiveContainer>
                    <LineChart data={data} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                            dataKey="day"
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                            tickLine={false}
                            axisLine={false}
                            ticks={[1, 5, 10, 15, 20, 25, 31]}
                        />
                        <YAxis
                            domain={[0, 110]}
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={100} stroke="#e5e7eb" strokeDasharray="4 4" />
                        <Line
                            type="monotone"
                            dataKey="percent"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
