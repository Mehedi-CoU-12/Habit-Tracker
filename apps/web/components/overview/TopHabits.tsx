import { HabitWithStats } from "../../app/dashboard/types";
import BloomIcon from "../bloom/BloomIcon";
import OverviewCard from "./OverviewCard";

export default function TopHabits({ habits }: { habits: HabitWithStats[] }) {
    const sorted = [...habits].sort((a, b) => b.percent - a.percent);

    return (
        <OverviewCard
            title="Top habits"
            className="h-full"
            bodyClassName="flex-1 min-h-0 overflow-y-auto p-5 pr-3"
        >
            {sorted.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
                    <BloomIcon name="sprout" size={40} className="text-line" />
                    <div>
                        <p className="text-sm font-medium text-muted">
                            No habits yet
                        </p>
                        <p className="mt-0.5 text-xs text-muted/70">
                            Plant a seed to see your strongest growers
                        </p>
                    </div>
                </div>
            ) : (
                <ol className="space-y-3">
                    {sorted.slice(0, 10).map((h, i) => (
                        <li
                            key={h.id}
                            className={`flex items-center gap-3 rounded-xl px-2 py-1 ${
                                i === 0 ? "bg-accent-soft/40" : ""
                            }`}
                        >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface2">
                                <BloomIcon
                                    name={h.icon}
                                    size={16}
                                    className="text-ink2"
                                />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="truncate text-sm text-ink">
                                        {h.name}
                                    </span>
                                    <span className="ml-2 shrink-0 text-xs font-bold text-accent">
                                        {h.percent}%
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-surface2">
                                    <div
                                        className="h-1.5 rounded-full bg-accent transition-all"
                                        style={{ width: `${h.percent}%` }}
                                    />
                                </div>
                            </div>
                            <span className="flex w-12 shrink-0 items-center justify-end gap-1 text-right text-xs font-bold text-accent">
                                <BloomIcon
                                    name="flame"
                                    size={12}
                                    fill="currentColor"
                                    strokeWidth={1.2}
                                />
                                {h.streak}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </OverviewCard>
    );
}
