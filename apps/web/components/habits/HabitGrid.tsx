// components/habits/HabitGrid.tsx
import HabitRow from "./HabitRow";

export default function HabitGrid({ habits }: any) {
  return (
    <div>
      {habits.map((h: any) => (
        <HabitRow key={h.id} habit={h} />
      ))}
    </div>
  );
}
