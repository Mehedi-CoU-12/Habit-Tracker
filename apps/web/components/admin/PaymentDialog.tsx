"use client";

import { useEffect, useState } from "react";
import BloomIcon from "../bloom/BloomIcon";

/**
 * Modal for the two money flows: approving a member (payment optional — you
 * may be approving a friend for free) and recording a standalone payment
 * (amount required). Modeled on ConfirmDialog, plus the two form fields.
 */
export default function PaymentDialog({
    open,
    title,
    description,
    confirmLabel,
    requireAmount = false,
    loading = false,
    onSubmit,
    onClose,
}: {
    open: boolean;
    title: string;
    description?: React.ReactNode;
    confirmLabel: string;
    requireAmount?: boolean;
    loading?: boolean;
    onSubmit: (payload: { amount: number | null; note: string }) => void;
    onClose: () => void;
}) {
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setAmount("");
            setNote("");
            setError("");
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !loading) onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, loading, onClose]);

    if (!open) return null;

    function handleSubmit() {
        const trimmed = amount.trim();
        const parsed = trimmed === "" ? null : Number(trimmed);
        if (requireAmount && (parsed === null || parsed <= 0)) {
            setError("Enter the amount that was paid.");
            return;
        }
        if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) {
            setError("Amount must be a whole number of Taka.");
            return;
        }
        onSubmit({ amount: parsed, note: note.trim() });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-(--bloom-overlay) p-4"
            onClick={() => !loading && onClose()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-dialog-title"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ animation: "toast-in 0.2s ease" }}
                className="w-full max-w-sm rounded-3xl border border-line bg-bg p-6 shadow-(--bloom-card-shadow)"
            >
                <div className="flex flex-col items-center text-center">
                    <span className="mb-4 grid h-14 w-14 place-items-center rounded-full border border-line bg-accent-soft/40">
                        <BloomIcon
                            name="check"
                            size={24}
                            stroke="var(--bloom-accent-deep)"
                            strokeWidth={1.8}
                        />
                    </span>
                    <h2
                        id="payment-dialog-title"
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

                <div className="mt-5 space-y-4 text-left">
                    <div>
                        <label
                            htmlFor="payment-amount"
                            className="mb-1.5 block text-sm font-medium text-ink2"
                        >
                            Amount (৳){requireAmount ? "" : " — optional"}
                        </label>
                        <input
                            id="payment-amount"
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            placeholder="e.g. 500"
                            value={amount}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                setError("");
                            }}
                            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="payment-note"
                            className="mb-1.5 block text-sm font-medium text-ink2"
                        >
                            Note — optional
                        </label>
                        <input
                            id="payment-note"
                            type="text"
                            maxLength={300}
                            placeholder="e.g. cash, June"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                        />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 cursor-pointer rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink2 transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
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
