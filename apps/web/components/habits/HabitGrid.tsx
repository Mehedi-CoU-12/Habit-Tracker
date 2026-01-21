import { Habit, HabitLog } from "../../app/dashboard/page";
import HabitRow from "./HabitRow";

export default function HabitGrid({
    habits,
    logs,
    onToggle,
}: {
    habits: Habit[];
    logs: HabitLog[];
    onToggle: (habitId: number, day: number) => void;
}) {
    return (
        <div className="space-y-1">
            {habits.map((h) => (
                <HabitRow
                    key={h.id}
                    habit={h}
                    logs={logs}
                    onToggle={onToggle}
                />
            ))}
        </div>
    );
}
