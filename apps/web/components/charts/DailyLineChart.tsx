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
import { ACCENTS, NEUTRALS, useBloom } from "../../provider/theme";

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
        <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-ink2">Day {label}</p>
            <p className="font-bold text-accent">{value}%</p>
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
    const { dark, accent } = useBloom();
    const n = dark ? NEUTRALS.dark : NEUTRALS.light;
    const gridColor = n.line;
    const tickColor = n.muted;
    const lineColor = ACCENTS[accent].accent;

    return (
        <OverviewCard title={`Daily progress — ${monthLabel}`} bodyClassName="p-5">
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
                            stroke={lineColor}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{
                                r: 4,
                                fill: lineColor,
                                strokeWidth: 0,
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </OverviewCard>
    );
}
