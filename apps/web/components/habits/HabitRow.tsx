// components/habits/HabitRow.tsx
import { useState } from "react";
import { HabitWithStats, HabitLog } from "../../app/dashboard/types";
import { IconCheckTiny, IconCloseSmall } from "../icons/Icon";

function isPastDay(year: number, month: number, day: number): boolean {
    const today = new Date();
    const todayMidnight = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    const cellDate = new Date(year, month - 1, day);
    return cellDate < todayMidnight;
}

export default function HabitRow({
    habit,
    logs,
    daysInMonth,
    year,
    month,
    onToggle,
    onDelete,
    isEven,
}: {
    habit: HabitWithStats;
    logs: HabitLog[];
    daysInMonth: number;
    year: number;
    month: number;
    onToggle: (habitId: string, day: number) => void;
    onDelete: (habitId: string) => void;
    isEven: boolean;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    function isChecked(day: number) {
        return logs.some(
            (l) => l.habitId === habit.id && l.day === day && l.completed,
        );
    }

    const bg = isEven
        ? "bg-white dark:bg-gray-800"
        : "bg-gray-50/50 dark:bg-gray-700/20";

    return (
        <tr className={`${bg} border-b border-gray-100 dark:border-gray-700 last:border-0`}>
            {/* Habit name + delete — sticky */}
            <td className={`sticky left-0 z-10 ${bg} px-4 py-2 w-36`}>
                <div className="flex items-center gap-2">
                    <span
                        className="font-medium text-gray-800 dark:text-gray-200 truncate"
                        title={habit?.name?.length > 20 ? habit.name : undefined}
                    >
                        {habit?.name?.length > 20
                            ? habit?.name?.slice(0, 20) + "..."
                            : habit?.name}
                    </span>

                    {confirmDelete ? (
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => onDelete(habit.id)}
                                className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                            >
                                No
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="shrink-0 cursor-pointer text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
                            aria-label={`Delete ${habit.name}`}
                        >
                            <IconCloseSmall />
                        </button>
                    )}
                </div>
            </td>

            {/* Goal */}
            <td className="text-center py-2 w-8 text-gray-500 dark:text-gray-400 tabular-nums">
                {habit.goal}
            </td>

            {/* Day checkboxes */}
            {DAYS.map((day) => {
                const checked = isChecked(day);
                const past = isPastDay(year, month, day);

                return (
                    <td key={day} className="text-center py-2 w-6">
                        <button
                            onClick={() => !past && onToggle(habit.id, day)}
                            disabled={past}
                            title={past ? "Cannot edit past days" : undefined}
                            className={`w-5 h-5 mx-auto flex items-center justify-center rounded border transition-colors ${
                                past
                                    ? checked
                                        ? "bg-indigo-300 border-indigo-300 cursor-not-allowed opacity-60"
                                        : "border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                                    : checked
                                      ? "cursor-pointer bg-indigo-500 border-indigo-500 hover:bg-indigo-600"
                                      : "cursor-pointer border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500"
                            }`}
                            aria-label={`Day ${day}${past ? " (locked)" : ""}`}
                        >
                            {checked && (
                                <span className="block w-3 h-3 text-white">
                                    <IconCheckTiny />
                                </span>
                            )}
                        </button>
                    </td>
                );
            })}

            {/* Stats */}
            <td className="text-center py-2 w-11 font-semibold text-indigo-700 dark:text-indigo-400 tabular-nums">
                {habit.completed}
            </td>
            <td className="text-center py-2 w-9 text-gray-500 dark:text-gray-400 tabular-nums">
                {habit.left}
            </td>
            <td className="text-center py-2 w-9 text-gray-700 dark:text-gray-300 tabular-nums">
                {habit.percent}%
            </td>

            {/* Progress bar */}
            <td className="px-3 py-2 w-24">
                <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.min(habit.percent, 100)}%` }}
                    />
                </div>
            </td>
        </tr>
    );
}
