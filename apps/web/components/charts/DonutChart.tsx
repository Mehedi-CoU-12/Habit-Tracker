"use client";

import { PieChart, Pie, Cell } from "recharts";
import OverviewCard from "../overview/OverviewCard";
import { ACCENTS, NEUTRALS, useBloom } from "../../provider/theme";

export default function DonutChart({
    completed,
    total,
}: {
    completed: number;
    total: number;
}) {
    const { dark, accent } = useBloom();
    const accentColor = ACCENTS[accent].accent;
    const leftColor = (dark ? NEUTRALS.dark : NEUTRALS.light).surface2;

    const left = total - completed;
    const donePercent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const leftPercent = 100 - donePercent;

    const data = [
        { name: "Completed", value: completed },
        { name: "Left", value: Math.max(left, 0) },
    ];

    return (
        <OverviewCard title="Daily progress" bodyClassName="p-4">
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
                            <Cell fill={accentColor} />
                            <Cell fill={leftColor} />
                        </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display text-3xl text-ink">
                            {donePercent}%
                        </span>
                        <span className="text-xs text-muted">complete</span>
                    </div>
                </div>

                <div className="mt-2 flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full bg-accent" />
                        <span className="text-ink2">Done</span>
                        <span className="font-semibold text-ink">
                            {donePercent}%
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full bg-surface2" />
                        <span className="text-ink2">Left</span>
                        <span className="font-semibold text-ink">
                            {leftPercent}%
                        </span>
                    </div>
                </div>

                <p className="mt-2 text-xs text-muted">
                    {completed} of {total} habit-days completed
                </p>
            </div>
        </OverviewCard>
    );
}
