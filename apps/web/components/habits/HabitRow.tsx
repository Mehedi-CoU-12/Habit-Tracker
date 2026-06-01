// components/habits/HabitRow.tsx
import { useState } from "react";
import { HabitWithStats, HabitLog } from "../../app/dashboard/types";
import { IconCloseSmall } from "../icons/Icon";
import BloomIcon from "../bloom/BloomIcon";

function isFutureDay(year: number, month: number, day: number): boolean {
    const today = new Date();
    const todayMidnight = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    return new Date(year, month - 1, day) > todayMidnight;
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

    const bg = isEven ? "bg-surface" : "bg-surface2/30";

    return (
        <tr className={`${bg} border-b border-line last:border-0`}>
            {/* Habit name + delete — sticky */}
            <td className={`sticky left-0 z-10 ${bg} w-44 px-4 py-2`}>
                <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface2">
                        <BloomIcon
                            name={habit.icon}
                            size={14}
                            className="text-ink2"
                        />
                    </span>
                    <span
                        className="truncate font-medium text-ink"
                        title={
                            habit?.name?.length > 16 ? habit.name : undefined
                        }
                    >
                        {habit?.name?.length > 16
                            ? habit?.name?.slice(0, 16) + "…"
                            : habit?.name}
                    </span>

                    {confirmDelete ? (
                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                onClick={() => onDelete(habit.id)}
                                className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-semibold text-white bg-red-500 transition-colors hover:bg-red-600"
                            >
                                Yes
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-muted transition-colors hover:text-ink"
                            >
                                No
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="shrink-0 cursor-pointer text-line transition-colors hover:text-red-500"
                            aria-label={`Delete ${habit.name}`}
                        >
                            <IconCloseSmall />
                        </button>
                    )}
                </div>
            </td>

            {/* Goal */}
            <td className="w-8 py-2 text-center tabular-nums text-muted">
                {habit.goal}
            </td>

            {/* Day checkboxes */}
            {DAYS.map((day) => {
                const checked = isChecked(day);
                const future = isFutureDay(year, month, day);

                return (
                    <td key={day} className="w-6 py-2 text-center">
                        <button
                            onClick={() => !future && onToggle(habit.id, day)}
                            disabled={future}
                            title={
                                future ? "Cannot log future days" : undefined
                            }
                            className={`mx-auto flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                                future
                                    ? checked
                                        ? "cursor-not-allowed border-green/60 bg-green/60 opacity-60"
                                        : "cursor-not-allowed border-line bg-surface2"
                                    : checked
                                      ? "cursor-pointer border-green bg-green hover:brightness-95"
                                      : "cursor-pointer border-line hover:border-accent"
                            }`}
                            aria-label={`Day ${day}${future ? " (future, locked)" : ""}`}
                        >
                            {checked && (
                                <BloomIcon
                                    name="check"
                                    size={12}
                                    stroke="#fff"
                                    strokeWidth={2.6}
                                />
                            )}
                        </button>
                    </td>
                );
            })}

            {/* Streak */}
            <td className="w-11 py-2 text-center">
                <span className="inline-flex items-center justify-center gap-0.5 font-bold tabular-nums text-accent">
                    <BloomIcon
                        name="flame"
                        size={12}
                        fill="currentColor"
                        strokeWidth={1.2}
                    />
                    {habit.streak}
                </span>
            </td>
            <td className="w-11 py-2 text-center font-semibold tabular-nums text-green-deep">
                {habit.completed}
            </td>
            <td className="w-9 py-2 text-center tabular-nums text-ink2">
                {habit.percent}%
            </td>

            {/* Progress bar */}
            <td className="w-24 px-3 py-2">
                <div className="h-2 w-full rounded-full bg-surface2">
                    <div
                        className="h-2 rounded-full bg-accent transition-all"
                        style={{ width: `${Math.min(habit.percent, 100)}%` }}
                    />
                </div>
            </td>
        </tr>
    );
}
