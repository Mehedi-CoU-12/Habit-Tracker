import { useEffect, useRef, useState } from "react";
import { useOnline, usePendingCount, useSyncStatus } from "./hooks";

/**
 * The single UI state consumed by the sync surfaces. Exactly one kind is active
 * at a time, so a component just switches on `kind`:
 *  - offline / error → persistent full-width bar (the existing connectivity system)
 *  - syncing / saved → ambient pill (subtle, non-intrusive)
 *  - hidden          → nothing at all (the normal, fast, online case)
 */
export type SyncView =
    | { kind: "hidden" }
    | { kind: "offline"; pending: number }
    | { kind: "syncing"; pending: number }
    | { kind: "saved"; reconnected: boolean }
    | { kind: "error"; pending: number };

// Don't reveal "Syncing" until it has lasted this long — a fast online write
// finishes first and stays completely silent (kills the flicker).
const SHOW_DELAY = 500;
// Once revealed, keep it up at least this long so it can never blink out
// mid-read, even if the sync resolves an instant later.
const MIN_VISIBLE = 1000;
// How long the "Saved" confirmation lingers before it fades away.
const SAVED_HOLD = 1800;

/**
 * Presentation layer over the raw sync signals. Offline and error pass through
 * live (persistent — nothing to debounce). The syncing → saved → hidden ambient
 * arc is time-gated so the common case (online write that syncs in <500ms)
 * produces no UI at all, and a genuine sync never flashes.
 *
 * The internal machine is keyed ONLY on [online, status] — deliberately not on
 * `pending`. A draining queue's count ticks down every few hundred ms; if that
 * re-ran the machine it would keep resetting the reveal timer and the indicator
 * would never appear. The count is read live at return time instead, so
 * "Syncing 3 changes…" still counts down while the phase stays put.
 */
export function useSyncView(): SyncView {
    const online = useOnline();
    const pending = usePendingCount();
    const status = useSyncStatus();

    const [phase, setPhase] = useState<"hidden" | "syncing" | "saved">(
        "hidden",
    );
    const visible = useRef(false); // did this sync cross the reveal threshold?
    const shownAt = useRef(0); // when it was revealed (for MIN_VISIBLE)
    const wasOffline = useRef(false); // were we offline before this sync began?
    const reconnected = useRef(false); // snapshot of the above at reveal time
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clear = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    };

    useEffect(() => {
        // Offline: remember it (so the eventual drain can say "Back online…"),
        // drop any ambient state — the persistent bar takes over via the return.
        if (!online) {
            clear();
            visible.current = false;
            wasOffline.current = true;
            setPhase("hidden");
            return;
        }
        // Error: persistent bar takes over; clear any ambient state.
        if (status === "error") {
            clear();
            visible.current = false;
            setPhase("hidden");
            return;
        }

        if (status === "syncing") {
            // Already on screen — cancel any pending hide/saved chain and keep
            // showing it (coalesces back-to-back syncs into one steady state).
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

        // status === "idle"
        // Never revealed → the sync was fast; stay silent (the happy path).
        if (!visible.current) {
            clear();
            setPhase("hidden");
            return;
        }
        // Was visible → honor MIN_VISIBLE, confirm with "Saved", then fade.
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

    // Persistent states are derived live so they react instantly and need no
    // timers; ambient states come from the debounced machine above.
    if (!online) return { kind: "offline", pending };
    if (status === "error") return { kind: "error", pending };
    if (phase === "syncing") return { kind: "syncing", pending };
    if (phase === "saved")
        return { kind: "saved", reconnected: reconnected.current };
    return { kind: "hidden" };
}
