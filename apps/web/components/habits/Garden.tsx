"use client";

import Link from "next/link";
import { HabitWithStats } from "../../app/dashboard/types";
import OverviewCard from "../overview/OverviewCard";
import Plant from "../bloom/Plant";
import BloomIcon from "../bloom/BloomIcon";

/**
 * The signature Bloom view — a grid of plants, one per habit, that grow with
 * each habit's streak and wilt (dim + tilt) when not yet done today.
 * Tapping a plant toggles today's check-in for that habit.
 */
export default function Garden({
    habits,
    onToggleToday,
}: {
    habits: HabitWithStats[];
    onToggleToday: (habitId: string) => void;
}) {
    const done = habits.filter((h) => h.doneToday).length;

    return (
        <OverviewCard
            title="Your garden, today"
            action={
                <span className="flex items-center gap-3">
                    <span className="text-xs font-bold text-ink2">
                        {done} of {habits.length} watered ☿
                    </span>
                    <Link
                        href="/focus"
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-accent-deep"
                        title="Start a focus session"
                    >
                        <BloomIcon name="sun" size={13} strokeWidth={2} />
                        Focus
                    </Link>
                </span>
            }
            bodyClassName="p-5"
        >
            {habits.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Plant streak={0} size={72} />
                    <p className="text-sm text-muted">
                        An empty pot. Plant a seed to start your garden.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                    {habits.map((h) => (
                        <button
                            key={h.id}
                            onClick={() => onToggleToday(h.id)}
                            title={
                                h.doneToday
                                    ? `${h.name} — done today, tap to undo`
                                    : `${h.name} — tap to water`
                            }
                            className={`flex cursor-pointer flex-col items-center rounded-bloom px-1 pb-3 pt-2 transition-colors ${
                                h.doneToday
                                    ? "bg-green-soft"
                                    : "hover:bg-surface2/50"
                            }`}
                        >
                            <Plant
                                streak={h.streak}
                                doneToday={h.doneToday}
                                size={84}
                            />
                            <span className="mt-[-4px] truncate text-xs font-bold text-ink">
                                {h.name}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                                <BloomIcon
                                    name="flame"
                                    size={10}
                                    fill="currentColor"
                                    strokeWidth={1.2}
                                />
                                {h.streak}d
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </OverviewCard>
    );
}
