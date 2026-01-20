// components/overview/TopHabits.tsx
export default function TopHabits({ habits }: { habits: any[] }) {
  const sorted = [...habits].sort(
    (a, b) => b.completed / b.goal - a.completed / a.goal
  );

  return (
    <div>
      <h3 className="font-bold mb-2">Top Habits</h3>
      {sorted.slice(0, 5).map((h, i) => (
        <div key={h.id} className="flex justify-between">
          <span>{i + 1}. {h.name}</span>
          <span>{Math.round((h.completed / h.goal) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
