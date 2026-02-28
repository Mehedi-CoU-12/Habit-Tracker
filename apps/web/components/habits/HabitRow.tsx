// components/habits/HabitRow.tsx
import { HabitWithStats, HabitLog } from "../../app/dashboard/page";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function HabitRow({
    habit,
    logs,
    onToggle,
    isEven,
}: {
    habit: HabitWithStats;
    logs: HabitLog[];
    onToggle: (habitId: number, day: number) => void;
    isEven: boolean;
}) {
    function isChecked(day: number) {
        return logs.some(
            (l) => l.habitId === habit.id && l.day === day && l.completed,
        );
    }

    const bg = isEven ? "bg-white" : "bg-gray-50/50";

    return (
        <tr className={`${bg} border-b border-gray-100 last:border-0`}>
            {/* Habit name — sticky */}
            <td className={`sticky left-0 z-10 ${bg} px-4 py-2 font-medium text-gray-800 min-w-36`}>
                {habit.name}
            </td>

            {/* Goal */}
            <td className="text-center px-2 py-2 text-gray-500 tabular-nums">{habit.goal}</td>

            {/* Day checkboxes */}
            {DAYS.map((day) => {
                const checked = isChecked(day);
                return (
                    <td key={day} className="text-center px-1 py-2">
                        <button
                            onClick={() => onToggle(habit.id, day)}
                            className={`w-5 h-5 rounded transition-colors border ${
                                checked
                                    ? "bg-indigo-500 border-indigo-500 text-white"
                                    : "border-gray-300 hover:border-indigo-300"
                            }`}
                            aria-label={`Toggle day ${day}`}
                        >
                            {checked && (
                                <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    </td>
                );
            })}

            {/* Stats */}
            <td className="text-center px-3 py-2 font-semibold text-indigo-700 tabular-nums">{habit.completed}</td>
            <td className="text-center px-3 py-2 text-gray-500 tabular-nums">{habit.left}</td>
            <td className="text-center px-3 py-2 text-gray-700 tabular-nums">{habit.percent}%</td>

            {/* Progress bar */}
            <td className="px-4 py-2 min-w-24">
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100">
                        <div
                            className="h-2 rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${Math.min(habit.percent, 100)}%` }}
                        />
                    </div>
                </div>
            </td>
        </tr>
    );
}
