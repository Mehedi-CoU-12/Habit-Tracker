import { useEffect, useState } from "react";

export type ToastType = "error" | "success" | "info";

export type Toast = {
    id: number;
    type: ToastType;
    message: string;
    duration: number;
};

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function notify() {
    for (const l of listeners) l(toasts);
}

export function subscribeToasts(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getToasts(): Toast[] {
    return toasts;
}

export function dismissToast(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
}

export function addToast(
    message: string,
    type: ToastType = "info",
    duration = 4000,
): number {
    const existing = toasts.find(
        (t) => t.message === message && t.type === type,
    );
    if (existing) {
        return existing.id;
    }
    const id = ++counter;
    toasts = [...toasts, { id, type, message, duration }];
    notify();
    return id;
}

export const toast = {
    error: (message: string, duration = 4500) =>
        addToast(message, "error", duration),
    success: (message: string, duration = 3000) =>
        addToast(message, "success", duration),
    info: (message: string, duration = 3500) =>
        addToast(message, "info", duration),
};

export function useToasts(): Toast[] {
    const [list, setList] = useState<Toast[]>(toasts);
    useEffect(() => {
        return subscribeToasts(setList);
    }, []);
    return list;
}
