// components/charts/DailyLineChart.tsx
"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

export default function DailyLineChart({
    data,
}: {
    data: { day: number; percent: number }[];
}) {
    return (
        <div className="w-full h-64">
            <ResponsiveContainer>
                <LineChart data={data}>
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line
                        type="monotone"
                        dataKey="percent"
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
