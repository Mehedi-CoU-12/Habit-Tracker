"use client";

import { useState } from "react";
import { HABIT_TEMPLATES, HabitTemplate } from "../../src/lib/templates";

interface Props {
    onClose: () => void;
    onApply: (templateId: string) => void;
    loading: boolean;
}

export default function TemplatesModal({ onClose, onApply, loading }: Props) {
    const [selected, setSelected] = useState<HabitTemplate | null>(null);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">
                            Habit templates
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Pick a pack and add all habits at once
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="cursor-pointer text-gray-400 hover:text-gray-600 transition"
                        aria-label="Close"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Template list */}
                <div className="overflow-y-auto flex-1 p-4 space-y-2">
                    {HABIT_TEMPLATES.map((tpl) => (
                        <button
                            key={tpl.id}
                            onClick={() =>
                                setSelected(
                                    selected?.id === tpl.id ? null : tpl,
                                )
                            }
                            className={`w-full cursor-pointer text-left rounded-xl border p-4 transition ${
                                selected?.id === tpl.id
                                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20"
                                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
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
                                        <p className="text-sm font-semibold text-gray-900">
                                            {tpl.name}
                                        </p>
                                        <span className="shrink-0 text-xs text-gray-400">
                                            {tpl.habits.length} habits
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        {tpl.description}
                                    </p>

                                    {/* Habit pills */}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {tpl.habits.map((h) => (
                                            <span
                                                key={h.name}
                                                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
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
                <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 cursor-pointer rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!selected || loading}
                        onClick={() => selected && onApply(selected.id)}
                        className="flex-1 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading
                            ? "Adding…"
                            : selected
                              ? `Add ${selected.habits.length} habits`
                              : "Select a template"}
                    </button>
                </div>
            </div>
        </div>
    );
}
