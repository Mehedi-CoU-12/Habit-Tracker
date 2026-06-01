"use client";

import { useState } from "react";
import { HABIT_TEMPLATES, HabitTemplate } from "../../src/lib/templates";
import { IconClose } from "../icons/Icon";

interface Props {
    onClose: () => void;
    onApply: (templateId: string) => void;
    loading: boolean;
}

export default function TemplatesModal({ onClose, onApply, loading }: Props) {
    const [selected, setSelected] = useState<HabitTemplate | null>(null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--bloom-overlay) p-4">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-line bg-bg shadow-(--bloom-card-shadow)">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-line px-6 py-4">
                    <div>
                        <h2 className="font-display text-2xl text-ink">
                            Seed packs
                        </h2>
                        <p className="mt-0.5 text-xs text-muted">
                            Pick a pack and plant several habits at once
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="cursor-pointer text-muted transition hover:text-ink"
                        aria-label="Close"
                    >
                        <IconClose />
                    </button>
                </div>

                {/* Template list */}
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                    {HABIT_TEMPLATES.map((tpl) => (
                        <button
                            key={tpl.id}
                            onClick={() =>
                                setSelected(
                                    selected?.id === tpl.id ? null : tpl,
                                )
                            }
                            className={`w-full cursor-pointer rounded-bloom border p-4 text-left transition ${
                                selected?.id === tpl.id
                                    ? "border-accent bg-accent-soft/40"
                                    : "border-line hover:border-accent hover:bg-surface2/40"
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${tpl.color}`}
                                >
                                    {tpl.emoji}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-ink">
                                            {tpl.name}
                                        </p>
                                        <span className="shrink-0 text-xs text-muted">
                                            {tpl.habits.length} habits
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted">
                                        {tpl.description}
                                    </p>

                                    {/* Habit pills */}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {tpl.habits.map((h) => (
                                            <span
                                                key={h.name}
                                                className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-ink2"
                                            >
                                                {h.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex gap-3 border-t border-line px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 cursor-pointer rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink2 transition hover:bg-surface2"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!selected || loading}
                        onClick={() => selected && onApply(selected.id)}
                        className="flex-1 cursor-pointer rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading
                            ? "Planting…"
                            : selected
                              ? `Plant ${selected.habits.length} habits`
                              : "Select a pack"}
                    </button>
                </div>
            </div>
        </div>
    );
}
