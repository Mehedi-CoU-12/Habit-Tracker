"use client";

import { useEffect, useState } from "react";
import Plant from "../bloom/Plant";
import { MILESTONES } from "../../src/lib/progress";

const COPY: Record<number, { title: string; line: string }> = {
    7: {
        title: "First bloom",
        line: "A week of showing up. Your plant has flowered.",
    },
    30: {
        title: "Full bloom",
        line: "A month strong. This is who you are now.",
    },
    100: {
        title: "Evergreen",
        line: "100 days. Few gardens ever grow this far.",
    },
};

/** Celebrates a habit reaching a 7, 30 or 100-day streak. */
export default function MilestoneModal({
    name,
    days,
    onClose,
}: {
    name: string;
    days: number;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const copy = COPY[days] ?? COPY[7]!;
    const message = `${days}-day streak on ${name} 🌸 — growing it with HabitFlow.`;

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    async function share() {
        try {
            if (navigator.share) {
                await navigator.share({ text: message });
                return;
            }
            await navigator.clipboard.writeText(message);
            setCopied(true);
        } catch {
            /* dismissed share sheet */
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-(--bloom-overlay) p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-title"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ animation: "toast-in 0.2s ease" }}
                className="w-full max-w-sm rounded-3xl border border-line bg-bg p-6 text-center shadow-(--bloom-card-shadow)"
            >
                <div className="flex justify-center">
                    <Plant streak={days} doneToday size={160} />
                </div>
                <h2
                    id="milestone-title"
                    className="font-display text-3xl text-accent"
                >
                    {days}-day streak
                </h2>
                <p className="mt-1 font-display text-xl text-ink">{name}</p>
                <p className="mt-3 text-sm text-ink2">{copy.line}</p>

                <div className="mt-5 grid grid-cols-3 gap-2">
                    {MILESTONES.map((m) => {
                        const earned = days >= m;
                        return (
                            <div
                                key={m}
                                className={`flex flex-col items-center rounded-2xl border py-2 ${
                                    earned
                                        ? "border-accent bg-accent-soft/40"
                                        : "border-line bg-surface opacity-55"
                                }`}
                            >
                                <Plant
                                    streak={m}
                                    doneToday={earned}
                                    size={40}
                                />
                                <span className="text-xs font-bold text-ink">
                                    {m} days
                                </span>
                                <span className="text-[10px] text-muted">
                                    {COPY[m]!.title}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 cursor-pointer rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-bold text-ink hover:bg-surface2"
                    >
                        Keep growing
                    </button>
                    <button
                        onClick={share}
                        className="flex-1 cursor-pointer rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white hover:brightness-95"
                    >
                        {copied ? "Copied!" : "Share"}
                    </button>
                </div>
            </div>
        </div>
    );
}
