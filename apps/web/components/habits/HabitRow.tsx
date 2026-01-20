// components/habits/HabitRow.tsx
export default function HabitRow({ habit }: any) {
  return (
    <div className="grid grid-cols-[200px_repeat(31,24px)] gap-1">
      <div>{habit.name}</div>
      {Array.from({ length: 31 }).map((_, i) => (
        <input key={i} type="checkbox" />
      ))}
    </div>
  );
}
