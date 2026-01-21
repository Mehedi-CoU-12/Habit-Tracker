// components/habits/HabitRow.tsx

import { Habit, HabitLog } from "../../app/dashboard/page";

export default function HabitRow({
    habit,
    logs,
    onToggle,
}: {
    habit: Habit;
    logs: HabitLog[];
    onToggle: (habitId: number, day: number) => void;
}) {
    function isChecked(day: number) {
        return logs.some(
            (l) => l.habitId === habit.id && l.day === day && l.completed,
        );
    }

    return (
        <div className="grid grid-cols-[200px_repeat(31,24px)] gap-1">
            <div className="font-medium">{habit.name}</div>
            {Array.from({ length: 31 }).map((_, i) => {
                const day = i + 1;
                return (
                    <input
                        key={day}
                        type="checkbox"
                        checked={isChecked(day)}
                        onChange={() => onToggle(habit.id, day)}
                    />
                );
            })}
        </div>
    );
}
