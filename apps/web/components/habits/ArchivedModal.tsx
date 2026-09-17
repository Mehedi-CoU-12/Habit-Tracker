"use client";

import { HabitWithStats } from "../../app/dashboard/types";
import { isDaily, scheduleLabel } from "../../src/lib/schedule";
import BloomIcon from "../bloom/BloomIcon";

/** "Archived 12 Sep" — the date is the only thing worth showing here. */
function when(iso: string | null | undefined): string {
    if (!iso) return "Archived";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Archived";
    return `Archived ${d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
    })}`;
}

/**
 * Archived habits: the reversible half of retiring one. They keep every log,
 * so their history still counts — this list only exists to bring one back, or
 * to finally delete it.
 */
export default function ArchivedModal({
    habits,
    restoringId,
    onRestore,
    onDelete,
    onClose,
}: {
    habits: HabitWithStats[];
    /** The habit currently being restored, so only its button shows a spinner. */
    restoringId?: string | null;
    onRestore: (habit: HabitWithStats) => void;
    onDelete: (habit: HabitWithStats) => void;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-(--bloom-overlay) p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="archived-modal-title"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-line bg-bg shadow-(--bloom-card-shadow)"
            >
                <div className="flex items-center justify-between border-b border-line px-6 py-4">
                    <div>
                        <h2
                            id="archived-modal-title"
                            className="font-display text-2xl text-ink"
                        >
                            Archived
                        </h2>
                        <p className="mt-0.5 text-xs text-muted">
                            Put down, not thrown away — their history still
                            counts in your stats.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="cursor-pointer text-muted transition hover:text-ink"
                        aria-label="Close"
                    >
                        <BloomIcon name="x" size={22} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {habits.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <BloomIcon
                                name="archive"
                                size={34}
                                className="text-muted"
                                strokeWidth={1.5}
                            />
                            <p className="font-display text-lg text-ink">
                                Nothing archived
                            </p>
                            <p className="text-sm text-muted">
                                Use the box icon on a habit row to archive it.
                            </p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {habits.map((h) => (
                                <li
                                    key={h.id}
                                    className="flex items-center gap-3 rounded-bloom border border-line px-3.5 py-3"
                                >
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2">
                                        <BloomIcon
                                            name={h.icon || "sprout"}
                                            size={17}
                                            className="text-ink2"
                                        />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-ink">
                                            {h.name}
                                        </p>
                                        <p className="truncate text-xs text-muted">
                                            {[
                                                when(h.archivedAt),
                                                isDaily(h.daysOfWeek)
                                                    ? null
                                                    : scheduleLabel(
                                                          h.daysOfWeek,
                                                      ),
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => onRestore(h)}
                                        disabled={restoringId === h.id}
                                        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent-deep transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                        aria-label={`Restore ${h.name}`}
                                    >
                                        <BloomIcon
                                            name="sprout"
                                            size={13}
                                            strokeWidth={1.8}
                                        />
                                        Restore
                                    </button>
                                    <button
                                        onClick={() => onDelete(h)}
                                        className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                                        aria-label={`Delete ${h.name}`}
                                        title="Delete permanently"
                                    >
                                        <BloomIcon name="trash" size={15} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
