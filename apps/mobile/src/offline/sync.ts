import { AppState } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { queryClient } from "../api/queryClient";
import {
    getOps,
    loadOutbox,
    markInFlight,
    removeOp,
    subscribe as subscribeOutbox,
    type Op,
} from "./outbox";

export type SyncStatus = "idle" | "syncing" | "error";

let status: SyncStatus = "idle";
const statusListeners = new Set<() => void>();

function setStatus(s: SyncStatus) {
    if (s === status) return;
    status = s;
    for (const l of statusListeners) l();
}

export function getStatus(): SyncStatus {
    return status;
}

export function subscribeStatus(l: () => void): () => void {
    statusListeners.add(l);
    return () => {
        statusListeners.delete(l);
    };
}

async function dispatch(op: Op): Promise<void> {
    switch (op.kind) {
        case "habit.create":
            await api.createHabit(op.payload);
            return;
        case "habit.update":
            await api.updateHabit(op.id, op.patch);
            return;
        case "habit.delete":
            await api.deleteHabit(op.id);
            return;
        case "log.set":
            await api.setLog(
                op.habitId,
                op.year,
                op.month,
                op.day,
                op.completed,
            );
            return;
        case "focus.record": {
            // The DTO rejects a null habitId — omit it for unlinked sessions.
            const { habitId, ...rest } = op.payload;
            await api.recordFocusSession({
                ...rest,
                ...(habitId ? { habitId } : {}),
            });
            return;
        }
    }
    // Exhaustiveness guard: without it a newly added op kind falls through
    // silently, the drain counts it as delivered, and the write is lost.
    return assertNever(op);
}

function assertNever(op: never): never {
    throw new Error(
        `Unhandled outbox op: ${(op as { kind?: string }).kind ?? "unknown"}`,
    );
}

/**
 * Whether an error means "this op can never succeed" (drop it) vs "try again
 * later" (keep it). Permanent = a definitive 4xx from the server: e.g. the
 * habit was deleted elsewhere (404) or a validation rejection. Everything else
 * — offline (status 0), timeouts, rate-limits, 5xx, and auth (401, which the
 * client resolves on the next authenticated request) — is transient.
 */
function isPermanent(err: unknown): boolean {
    const s = err instanceof ApiError ? err.status : undefined;
    if (s === undefined || s === 0) return false;
    if (s === 401 || s === 408 || s === 429) return false;
    return s >= 400 && s < 500;
}

let draining = false;
// A runSync arrived while a drain was in progress — run one follow-up pass so
// whatever it wanted synced isn't left waiting for the next external trigger.
let drainQueued = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 0;
// True once a drain was skipped because we were offline; the next successful
// drain then reconciles once (offline writes may need server-side truth).
let wasOffline = false;
// A reconcile is owed — set when we drop a permanent op (its optimistic write
// is now wrong) or recover from offline. Deliberately NOT set for steady-state
// online writes: those already match the server, so reconciling after each one
// would fire a full multi-month refetch per write and could clobber a newer
// optimistic toggle mid-flight (visible flicker).
let pendingReconcile = false;

/**
 * Drain the outbox FIFO. Single-flight; only runs while online. A synced op is
 * removed; a permanently-failed op is dropped so it can't wedge the queue; a
 * transient failure stops the drain (preserving order) and schedules a backoff
 * retry. Reconciles against the server only when it's actually needed.
 *
 * The gate MUST be claimed synchronously, before the first await. A single
 * write triggers runSync more than once in the same tick (the mutation's own
 * call plus the outbox-change subscriber); with an async gap before the flag
 * was set, each caller passed the check and dispatched the same head op —
 * duplicate POSTs per click. Late callers now just queue one follow-up pass.
 */
export async function runSync(): Promise<void> {
    if (draining) {
        drainQueued = true;
        return;
    }
    draining = true;
    try {
        do {
            drainQueued = false;
            await drainOnce();
        } while (drainQueued);
    } finally {
        draining = false;
    }
}

async function drainOnce(): Promise<void> {
    if (!onlineManager.isOnline()) {
        wasOffline = true;
        return;
    }
    await loadOutbox();
    if (getOps().length === 0) {
        setStatus("idle");
        // A previous drain may have owed a reconcile (permanent drop / offline
        // recovery) but exited on a transient error before running it.
        if (pendingReconcile) {
            pendingReconcile = false;
            await reconcile();
        }
        return;
    }

    setStatus("syncing");
    if (wasOffline) {
        pendingReconcile = true;
        wasOffline = false;
    }
    while (onlineManager.isOnline()) {
        const ops = getOps();
        if (ops.length === 0) break;
        const op = ops[0];
        // Pin the op so a concurrent enqueue can't mutate/cancel it while
        // its request body is already serialized and on the wire.
        markInFlight(op.key);
        try {
            await dispatch(op);
            await removeOp(op.key);
        } catch (err) {
            if (isPermanent(err)) {
                await removeOp(op.key);
                pendingReconcile = true;
                continue;
            }
            setStatus("error");
            scheduleRetry();
            return;
        } finally {
            markInFlight(null);
        }
    }
    setStatus("idle");
    backoff = 0;
    // Clear a stale backoff timer so a later failure gets a fresh 5s retry
    // rather than waiting out the previous (possibly 60s) backoff.
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }

    if (pendingReconcile) {
        pendingReconcile = false;
        await reconcile();
    }
}

function scheduleRetry() {
    if (retryTimer) return;
    backoff = Math.min(backoff ? backoff * 2 : 5000, 60000);
    retryTimer = setTimeout(() => {
        retryTimer = null;
        void runSync();
    }, backoff);
}

async function reconcile(): Promise<void> {
    // Server is the source of truth: pull the authoritative state so optimistic
    // guesses converge and any dropped op is corrected. No-ops while offline
    // (queries stay paused), so it's safe to always call.
    await queryClient.invalidateQueries({ queryKey: ["habits"] });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    await queryClient.invalidateQueries({ queryKey: ["focusStats"] });
}

/**
 * Reset the worker's in-memory state — called on sign-out so a queued retry
 * timer or partial drain from the previous session can't run against the next
 * account. The durable queue is cleared separately via clearOutbox().
 */
export function resetSync(): void {
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    draining = false;
    drainQueued = false;
    backoff = 0;
    wasOffline = false;
    pendingReconcile = false;
    setStatus("idle");
}

let started = false;

/**
 * Wire the drain triggers once: on reconnect, on app foreground, whenever the
 * queue changes (so an online write syncs immediately), and now at startup.
 */
export function startSync(): void {
    if (started) return;
    started = true;

    onlineManager.subscribe((online) => {
        if (online) void runSync();
    });
    AppState.addEventListener("change", (s) => {
        if (s === "active") void runSync();
    });
    subscribeOutbox(() => {
        if (onlineManager.isOnline()) void runSync();
    });

    void loadOutbox().then(() => runSync());
}
