"use client";

import { useEffect, useSyncExternalStore } from "react";
import BloomIcon from "../../components/bloom/BloomIcon";

export type ToastType = "error" | "success" | "info";

export type Toast = {
    id: number;
    type: ToastType;
    message: string;
    duration: number;
};

type Listener = (toasts: Toast[]) => void;

// Module-level store so `toast.error(...)` can be called from anywhere —
// React Query cache callbacks, plain event handlers, etc. — without needing
// the React context. The <Toaster /> subscribes via useSyncExternalStore.
let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function notify() {
    for (const l of listeners) l(toasts);
}

function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot() {
    return toasts;
}

export function dismissToast(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
}

function addToast(message: string, type: ToastType, duration: number): number {
    const id = ++counter;
    // De-dupe: if an identical message is already showing, don't stack it.
    if (toasts.some((t) => t.message === message && t.type === type)) {
        return id;
    }
    toasts = [...toasts, { id, type, message, duration }];
    notify();
    return id;
}

export const toast = {
    error: (message: string, duration = 6000) =>
        addToast(message, "error", duration),
    success: (message: string, duration = 4000) =>
        addToast(message, "success", duration),
    info: (message: string, duration = 4500) =>
        addToast(message, "info", duration),
};

export function useToasts(): Toast[] {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Best-effort extraction of a human-readable message from any thrown value. */
export function getErrorMessage(
    error: unknown,
    fallback = "Something went wrong. Please try again.",
): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return fallback;
}

const TYPE_STYLES: Record<
    ToastType,
    { icon: string; ring: string; iconColor: string }
> = {
    error: {
        icon: "x",
        ring: "border-red-300/70 bg-red-500/15",
        iconColor: "#ef4444",
    },
    success: {
        icon: "check",
        ring: "border-green/50 bg-green-soft",
        iconColor: "var(--bloom-green-deep)",
    },
    info: {
        icon: "bell",
        ring: "border-line bg-surface2",
        iconColor: "var(--bloom-ink2)",
    },
};

function ToastCard({ toast: t }: { toast: Toast }) {
    useEffect(() => {
        if (t.duration <= 0) return;
        const timer = setTimeout(() => dismissToast(t.id), t.duration);
        return () => clearTimeout(timer);
    }, [t.id, t.duration]);

    const style = TYPE_STYLES[t.type];

    return (
        <div
            role={t.type === "error" ? "alert" : "status"}
            aria-live={t.type === "error" ? "assertive" : "polite"}
            style={{ animation: "toast-in 0.25s ease" }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-bloom border border-line bg-bg px-4 py-3 shadow-(--bloom-card-shadow)"
        >
            <span
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border ${style.ring}`}
            >
                <BloomIcon
                    name={style.icon}
                    size={15}
                    stroke={style.iconColor}
                    strokeWidth={2}
                />
            </span>
            <p className="flex-1 pt-1 text-sm font-medium leading-snug text-ink">
                {t.message}
            </p>
            <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
                className="-mr-1 mt-0.5 shrink-0 cursor-pointer rounded-md p-1 text-muted transition hover:text-ink"
            >
                <BloomIcon name="x" size={15} />
            </button>
        </div>
    );
}

export function Toaster() {
    const items = useToasts();

    return (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
            {items.map((t) => (
                <ToastCard key={t.id} toast={t} />
            ))}
        </div>
    );
}
