"use client";

import { useState } from "react";
import { CreateHabitInput } from "../../src/lib/api";
import { HabitWithStats } from "../../app/dashboard/types";
import Plant from "../bloom/Plant";
import BloomIcon from "../bloom/BloomIcon";

/** Seed icons the user can pick for a habit. */
const ICON_CHOICES = [
    "leaf",
    "sun",
    "droplet",
    "book",
    "dumbbell",
    "coffee",
    "music",
    "pen",
    "moon",
    "cloud",
    "flame",
    "sprout",
];

/** Time-of-day options for when a habit is performed. */
const TOD_CHOICES: { v: string; label: string; icon: string }[] = [
    { v: "morning", label: "Morning", icon: "sun" },
    { v: "afternoon", label: "Afternoon", icon: "cloud" },
    { v: "evening", label: "Evening", icon: "moonStars" },
    { v: "anytime", label: "Anytime", icon: "sparkle" },
];

/**
 * Modal form for planting a new habit or editing an existing one. Passing a
 * `habit` switches it into edit mode; otherwise it creates a new habit.
 */
export default function HabitModal({
    habit,
    onClose,
    onSubmit,
    submitting,
}: {
    habit?: HabitWithStats | null;
    onClose: () => void;
    onSubmit: (input: CreateHabitInput) => void;
    submitting?: boolean;
}) {
    const isEdit = !!habit;
    const [name, setName] = useState(habit?.name ?? "");
    const [goal, setGoal] = useState(habit?.goal ?? 30);
    const [icon, setIcon] = useState(habit?.icon ?? "sprout");
    const [tod, setTod] = useState<string>(habit?.tod ?? "morning");
    const [verb, setVerb] = useState(habit?.verb ?? "");
    const [error, setError] = useState("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setError("Give your habit a name");
            return;
        }
        if (goal < 1 || goal > 31) {
            setError("Goal must be between 1 and 31");
            return;
        }
        onSubmit({
            name: name.trim(),
            goal,
            icon,
            tod,
            verb: verb.trim() || undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--bloom-overlay) p-4">
            <div className="w-full max-w-md rounded-3xl border border-line bg-bg shadow-(--bloom-card-shadow)">
                <div className="flex items-center justify-between border-b border-line px-6 py-5">
                    <h2 className="font-display text-2xl text-ink">
                        {isEdit ? "Edit habit" : "Plant a new habit"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="cursor-pointer text-muted transition hover:text-ink"
                        aria-label="Close"
                    >
                        <BloomIcon name="x" size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-6">
                    <div className="flex items-center gap-4">
                        <Plant streak={1} doneToday size={92} />
                        <div className="flex-1">
                            <input
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Run outside"
                                className="w-full border-b-2 border-line bg-transparent pb-1.5 font-display text-2xl text-ink outline-none focus:border-accent"
                            />
                            <p className="mt-2 text-xs text-muted">
                                Your seed grows as you keep the streak.
                            </p>
                        </div>
                    </div>

                    {/* Seed / icon */}
                    <div>
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
                            Seed
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {ICON_CHOICES.map((ic) => (
                                <button
                                    key={ic}
                                    type="button"
                                    onClick={() => setIcon(ic)}
                                    className={`grid aspect-square cursor-pointer place-items-center rounded-xl border transition ${
                                        icon === ic
                                            ? "border-accent bg-accent text-white"
                                            : "border-line bg-surface text-ink2 hover:border-accent"
                                    }`}
                                >
                                    <BloomIcon name={ic} size={18} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* When */}
                    <div>
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
                            When
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {TOD_CHOICES.map((o) => (
                                <button
                                    key={o.v}
                                    type="button"
                                    onClick={() => setTod(o.v)}
                                    className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border py-3 transition ${
                                        tod === o.v
                                            ? "border-ink bg-ink text-bg"
                                            : "border-line bg-surface text-ink2 hover:border-accent"
                                    }`}
                                >
                                    <BloomIcon name={o.icon} size={17} />
                                    <span className="text-[11px] font-semibold">
                                        {o.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Goal + note */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-muted">
                                Monthly goal
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={goal}
                                onChange={(e) => setGoal(Number(e.target.value))}
                                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-muted">
                                Note{" "}
                                <span className="font-normal normal-case text-muted/70">
                                    (optional)
                                </span>
                            </label>
                            <input
                                value={verb}
                                onChange={(e) => setVerb(e.target.value)}
                                placeholder="20 min"
                                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 cursor-pointer rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink2 transition hover:bg-surface2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <BloomIcon
                                name={isEdit ? "check" : "sprout"}
                                size={16}
                                stroke="#fff"
                                strokeWidth={2}
                            />
                            {isEdit
                                ? submitting
                                    ? "Saving…"
                                    : "Save changes"
                                : submitting
                                  ? "Planting…"
                                  : "Plant it"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
