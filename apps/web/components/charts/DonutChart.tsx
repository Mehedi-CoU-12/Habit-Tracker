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
  const data = [
    { name: "Completed", value: completed },
    { name: "Left", value: total - completed },
  ];

  return (
    <PieChart width={200} height={200}>
      <Pie
        data={data}
        innerRadius={60}
        outerRadius={80}
        dataKey="value"
      >
        <Cell fill="#F4A261" />
        <Cell fill="#E0E0E0" />
      </Pie>
    </PieChart>
  );
}
