import { HabitWithStats, HabitLog } from "../../app/dashboard/types";
import OverviewCard from "../overview/OverviewCard";
import HabitRow from "./HabitRow";

function isFutureDay(year: number, month: number, day: number): boolean {
    const today = new Date();
    const todayMidnight = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );
    return new Date(year, month - 1, day) > todayMidnight;
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
    onSkip,
    onDelete,
    onEdit,
}: {
    habits: HabitWithStats[];
    logs: HabitLog[];
    daysInMonth: number;
    monthLabel: string;
    year: number;
    month: number;
    onToggle: (habitId: string, day: number) => void;
    onSkip: (habitId: string, day: number, used: boolean) => void;
    onDelete: (habit: HabitWithStats) => void;
    onEdit: (habit: HabitWithStats) => void;
}) {
    const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <OverviewCard
            title={`The story so far — ${monthLabel}`}
            action={
                <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-md border border-line bg-surface2" />
                        Future
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-md bg-green" />
                        Done
                    </span>
                    {/* The only place the Alt+click gesture is discoverable,
                        so it says what it costs as well as what it does. */}
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-md border border-dashed border-accent" />
                        Skipped · alt+click a missed day
                    </span>
                </div>
            }
        >
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr className="border-b border-line bg-surface2/50">
                            <th className="sticky left-0 z-10 w-44 bg-surface2/50 px-4 py-3 text-left font-bold text-ink2">
                                Habit
                            </th>
                            <th className="w-8 py-3 text-center font-semibold text-muted">
                                Goal
                            </th>
                            {DAYS.map((d) => {
                                const future = isFutureDay(year, month, d);
                                const today = isToday(year, month, d);
                                return (
                                    <th
                                        key={d}
                                        className={`w-6 py-3 text-center font-medium ${
                                            today
                                                ? "font-bold text-accent"
                                                : future
                                                  ? "text-muted/50"
                                                  : "text-muted"
                                        }`}
                                    >
                                        {today ? (
                                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                                                {d}
                                            </span>
                                        ) : (
                                            d
                                        )}
                                    </th>
                                );
                            })}
                            <th className="w-11 py-3 text-center font-semibold text-muted">
                                Streak
                            </th>
                            <th className="w-11 py-3 text-center font-semibold text-muted">
                                Done
                            </th>
                            <th className="w-9 py-3 text-center font-semibold text-muted">
                                %
                            </th>
                            <th className="w-24 px-3 py-3 text-center font-semibold text-muted">
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
                                onSkip={onSkip}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                isEven={idx % 2 === 0}
                            />
                        ))}
                        {habits.length === 0 && (
                            <tr>
                                <td
                                    colSpan={daysInMonth + 6}
                                    className="py-12 text-center text-sm text-muted"
                                >
                                    No habits yet. Plant your first seed above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </OverviewCard>
    );
}
