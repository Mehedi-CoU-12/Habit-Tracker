// components/charts/WeeklyBarChart.tsx
"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

export default function WeeklyBarChart({
    data,
}: {
    data: { week: string; percent: number }[];
}) {
    return (
        <div className="w-full h-64">
            <ResponsiveContainer>
                <BarChart data={data}>
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="percent" radius={[6, 6, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
