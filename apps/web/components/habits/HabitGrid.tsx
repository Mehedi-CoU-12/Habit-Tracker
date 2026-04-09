import { HabitWithStats, HabitLog } from "../../app/dashboard/types";
import HabitRow from "./HabitRow";

export default function HabitGrid({
    habits,
    logs,
    daysInMonth,
    monthLabel,
    onToggle,
    onDelete,
}: {
    habits: HabitWithStats[];
    logs: HabitLog[];
    daysInMonth: number;
    monthLabel: string;
    onToggle: (habitId: string, day: number) => void;
    onDelete: (habitId: string) => void;
}) {
    const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Daily Habits — {monthLabel}
                </h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-3 font-semibold text-gray-600 min-w-40">
                                Habit
                            </th>
                            <th className="text-center px-2 py-3 font-semibold text-gray-500 w-10">Goal</th>
                            {DAYS.map((d) => (
                                <th key={d} className="text-center px-1 py-3 font-medium text-gray-400 w-7">
                                    {d}
                                </th>
                            ))}
                            <th className="text-center px-3 py-3 font-semibold text-gray-500 w-16">Done</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-500 w-12">Left</th>
                            <th className="text-center px-3 py-3 font-semibold text-gray-500 w-12">%</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-500 min-w-24">Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        {habits.map((h, idx) => (
                            <HabitRow
                                key={h.id}
                                habit={h}
                                logs={logs}
                                daysInMonth={daysInMonth}
                                onToggle={onToggle}
                                onDelete={onDelete}
                                isEven={idx % 2 === 0}
                            />
                        ))}
                        {habits.length === 0 && (
                            <tr>
                                <td
                                    colSpan={daysInMonth + 6}
                                    className="text-center py-12 text-gray-400 text-sm"
                                >
                                    No habits yet. Add your first habit above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
