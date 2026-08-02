import { useEffect, useRef, useState } from "react";
import { useOnline, usePendingCount, useSyncStatus } from "./hooks";

export type SyncView =
    | { kind: "hidden" }
    | { kind: "offline"; pending: number }
    | { kind: "syncing"; pending: number }
    | { kind: "saved"; reconnected: boolean }
    | { kind: "error"; pending: number };

const SHOW_DELAY = 500;

const MIN_VISIBLE = 1000;

const SAVED_HOLD = 1800;

export function useSyncView(): SyncView {
    const online = useOnline();
    const pending = usePendingCount();
    const status = useSyncStatus();

    const [phase, setPhase] = useState<"hidden" | "syncing" | "saved">(
        "hidden",
    );
    const visible = useRef(false);
    const shownAt = useRef(0);
    const wasOffline = useRef(false);
    const reconnected = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clear = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    };

    useEffect(() => {
        if (!online) {
            clear();
            visible.current = false;
            wasOffline.current = true;
            setPhase("hidden");
            return;
        }

        if (status === "error") {
            clear();
            visible.current = false;
            setPhase("hidden");
            return;
        }

        if (status === "syncing") {
            if (visible.current) {
                clear();
                return;
            }
            clear();
            timer.current = setTimeout(() => {
                shownAt.current = Date.now();
                reconnected.current = wasOffline.current;
                wasOffline.current = false;
                visible.current = true;
                setPhase("syncing");
            }, SHOW_DELAY);
            return;
        }

        if (!visible.current) {
            clear();
            setPhase("hidden");
            return;
        }

        clear();
        const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current));
        timer.current = setTimeout(() => {
            visible.current = false;
            setPhase("saved");
            timer.current = setTimeout(() => setPhase("hidden"), SAVED_HOLD);
        }, wait);
    }, [online, status]);

    // Clear any pending timer on unmount.
    useEffect(() => clear, []);

    if (!online) return { kind: "offline", pending };
    if (status === "error") return { kind: "error", pending };
    if (phase === "syncing") return { kind: "syncing", pending };
    if (phase === "saved")
        return { kind: "saved", reconnected: reconnected.current };
    return { kind: "hidden" };
}

export function useOfflineBarVisible(): boolean {
    const online = useOnline();
    const status = useSyncStatus();
    return !online || status === "error";
}
