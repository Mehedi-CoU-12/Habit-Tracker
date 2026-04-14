import { HabitWithStats, HabitLog } from "../../app/dashboard/types";
import OverviewCard from "../overview/OverviewCard";
import HabitRow from "./HabitRow";

function isPastDay(year: number, month: number, day: number): boolean {
    const today = new Date();
    const todayMidnight = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    return new Date(year, month - 1, day) < todayMidnight;
}

function isToday(year: number, month: number, day: number): boolean {
    const today = new Date();
    return (
        today.getFullYear() === year &&
        today.getMonth() + 1 === month &&
        today.getDate() === day
    );
}

export default function HabitGrid({
    habits,
    logs,
    daysInMonth,
    monthLabel,
    year,
    month,
    onToggle,
    onDelete,
}: {
    habits: HabitWithStats[];
    logs: HabitLog[];
    daysInMonth: number;
    monthLabel: string;
    year: number;
    month: number;
    onToggle: (habitId: string, day: number) => void;
    onDelete: (habitId: string) => void;
}) {
    const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <OverviewCard
            title={`Daily Habits — ${monthLabel}`}
            action={
                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700" />
                        Past (locked)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded border-2 border-indigo-400" />
                        Today
                    </span>
                </div>
            }
        >

            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700/50 text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 min-w-40">
                                Habit
                            </th>
                            <th className="text-center px-2 py-3 font-semibold text-gray-500 dark:text-gray-400 w-10">
                                Goal
                            </th>
                            {DAYS.map((d) => {
                                const past = isPastDay(year, month, d);
                                const today = isToday(year, month, d);
                                return (
                                    <th
                                        key={d}
                                        className={`text-center px-1 py-3 w-7 font-medium
                                            ${
                                                today
                                                    ? "text-indigo-600 font-bold"
                                                    : past
                                                      ? "text-gray-300 dark:text-gray-600"
                                                      : "text-gray-400 dark:text-gray-500"
                                            }`}
                                    >
                                        {today ? (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
                                                {d}
                                            </span>
                                        ) : (
                                            d
                                        )}
                                    </th>
                                );
                            })}
                            <th className="text-center px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 w-16">
                                Done
                            </th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 w-12">
                                Left
                            </th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-500 dark:text-gray-400 w-12">
                                %
                            </th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 min-w-24">
                                Progress
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {habits.map((h, idx) => (
                            <HabitRow
                                key={h.id}
                                habit={h}
                                logs={logs}
                                daysInMonth={daysInMonth}
                                year={year}
                                month={month}
                                onToggle={onToggle}
                                onDelete={onDelete}
                                isEven={idx % 2 === 0}
                            />
                        ))}
                        {habits.length === 0 && (
                            <tr>
                                <td
                                    colSpan={daysInMonth + 6}
                                    className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm"
                                >
                                    No habits yet. Add your first habit above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </OverviewCard>
    );
}
