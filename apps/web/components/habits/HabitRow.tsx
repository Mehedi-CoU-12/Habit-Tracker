// components/habits/HabitRow.tsx
import { HabitWithStats, HabitLog } from "../../app/dashboard/types";
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
    onSkip,
    onDelete,
    onEdit,
    isEven,
}: {
    habit: HabitWithStats;
    logs: HabitLog[];
    daysInMonth: number;
    year: number;
    month: number;
    onToggle: (habitId: string, day: number) => void;
    /** Spend or release a skip — streak insurance. Alt/Option + click. */
    onSkip: (habitId: string, day: number, used: boolean) => void;
    onDelete: (habit: HabitWithStats) => void;
    onEdit: (habit: HabitWithStats) => void;
    isEven: boolean;
}) {
    const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    function isChecked(day: number) {
        return logs.some(
            (l) => l.habitId === habit.id && l.day === day && l.completed,
        );
    }

    /** 0..1 of the day's target — 0 when nothing was logged. */
    function progress(day: number) {
        const log = logs.find((l) => l.habitId === habit.id && l.day === day);
        if (!log) return 0;
        return Math.min(1, log.amount / Math.max(1, habit.target ?? 1));
    }

    const skipped = new Set(habit.skippedDays);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    /** A day that is over — today is still open, so it cannot be forgiven. */
    const isPastDay = (day: number) =>
        new Date(year, month - 1, day) < todayMidnight;

    const bg = isEven ? "bg-surface" : "bg-surface2/30";

    return (
        <tr className={`group ${bg} border-b border-line last:border-0`}>
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

                    <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        <button
                            onClick={() => onEdit(habit)}
                            className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-surface2 hover:text-accent"
                            aria-label={`Edit ${habit.name}`}
                            title="Edit habit"
                        >
                            <BloomIcon name="pen" size={14} />
                        </button>
                        <button
                            onClick={() => onDelete(habit)}
                            className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                            aria-label={`Delete ${habit.name}`}
                            title="Delete habit"
                        >
                            <BloomIcon name="trash" size={14} />
                        </button>
                    </div>
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
                const part = checked ? 0 : progress(day);
                const isSkipped = skipped.has(day);
                // Only a day that is over and was actually missed can be
                // forgiven: a finished day has nothing to buy.
                const canSkip = !future && isPastDay(day) && !checked;

                return (
                    <td key={day} className="w-6 py-2 text-center">
                        <button
                            onClick={(e) => {
                                if (future) return;
                                // Alt/Option + click forgives the day instead
                                // of completing it — see the card's legend.
                                if (e.altKey && (canSkip || isSkipped)) {
                                    onSkip(habit.id, day, !isSkipped);
                                    return;
                                }
                                onToggle(habit.id, day);
                            }}
                            disabled={future}
                            title={
                                future
                                    ? "Cannot log future days"
                                    : isSkipped
                                      ? "Skipped — streak kept (Alt+click to undo)"
                                      : canSkip
                                        ? "Alt+click to use a skip"
                                        : undefined
                            }
                            className={`relative mx-auto flex h-5 w-5 items-center justify-center overflow-hidden rounded-md border transition-colors ${
                                future
                                    ? checked
                                        ? "cursor-not-allowed border-green/60 bg-green/60 opacity-60"
                                        : "cursor-not-allowed border-line bg-surface2"
                                    : checked
                                      ? "cursor-pointer border-green bg-green hover:brightness-95"
                                      : "cursor-pointer border-line hover:border-accent"
                            }`}
                            aria-label={`Day ${day}${
                                part > 0
                                    ? ` (${Math.round(part * 100)}% of target)`
                                    : ""
                            }${future ? " (future, locked)" : ""}`}
                        >
                            {/* A part-filled day fills from the bottom, so
                                progress is visible without reading as done. */}
                            {part > 0 && (
                                <span
                                    className="absolute inset-x-0 bottom-0 rounded-b-[3px] bg-green/40"
                                    style={{ height: `${part * 100}%` }}
                                />
                            )}
                            {/* Forgiven days get a dashed accent ring over
                                the empty cell rather than a fill of their own:
                                a skip bridges the streak, it is not progress. */}
                            {isSkipped && !checked && (
                                <span className="pointer-events-none absolute inset-0 rounded-md border border-dashed border-accent" />
                            )}
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
                {habit.skipsLeft > 0 && (
                    <span
                        className="ml-0.5 text-[10px] text-muted"
                        title={`${habit.skipsLeft} skip${habit.skipsLeft === 1 ? "" : "s"} left this month`}
                    >
                        +{habit.skipsLeft}
                    </span>
                )}
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
