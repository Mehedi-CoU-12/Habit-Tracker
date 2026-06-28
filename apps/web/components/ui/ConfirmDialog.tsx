"use client";

import { useEffect } from "react";
import BloomIcon from "../bloom/BloomIcon";

/**
 * Generic confirmation modal styled to match the Bloom design system.
 * Closes on Escape / overlay click (unless busy) and focuses the safe
 * (cancel) action by default — appropriate for destructive confirmations.
 */
export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "default",
    icon,
    loading = false,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "danger" | "default";
    icon?: string;
    loading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !loading) onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, loading, onClose]);

    if (!open) return null;

    const danger = tone === "danger";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-(--bloom-overlay) p-4"
            onClick={() => !loading && onClose()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ animation: "toast-in 0.2s ease" }}
                className="w-full max-w-sm rounded-3xl border border-line bg-bg p-6 shadow-(--bloom-card-shadow)"
            >
                <div className="flex flex-col items-center text-center">
                    <span
                        className={`mb-4 grid h-14 w-14 place-items-center rounded-full border ${
                            danger
                                ? "border-red-300/70 bg-red-500/15"
                                : "border-line bg-surface2"
                        }`}
                    >
                        <BloomIcon
                            name={icon ?? (danger ? "trash" : "bell")}
                            size={24}
                            stroke={danger ? "#ef4444" : "var(--bloom-ink2)"}
                            strokeWidth={1.8}
                        />
                    </span>
                    <h2
                        id="confirm-dialog-title"
                        className="font-display text-2xl text-ink"
                    >
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-2 text-sm leading-relaxed text-ink2">
                            {description}
                        </p>
                    )}
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        autoFocus
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 cursor-pointer rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink2 transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            danger
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-accent hover:bg-accent-deep"
                        }`}
                    >
                        {loading && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
