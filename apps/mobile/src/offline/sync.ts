import { AppState } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";
import { queryClient } from "../api/queryClient";
import {
    getOps,
    loadOutbox,
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
    }
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
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 0;

/**
 * Drain the outbox FIFO. Single-flight; only runs while online. A synced op is
 * removed; a permanently-failed op is dropped so it can't wedge the queue; a
 * transient failure stops the drain (preserving order) and schedules a backoff
 * retry. After making progress it reconciles against the server.
 */
export async function runSync(): Promise<void> {
    if (draining) return;
    if (!onlineManager.isOnline()) return;
    await loadOutbox();
    if (getOps().length === 0) {
        setStatus("idle");
        return;
    }

    draining = true;
    setStatus("syncing");
    let progressed = false;
    try {
        while (onlineManager.isOnline()) {
            const ops = getOps();
            if (ops.length === 0) break;
            const op = ops[0];
            try {
                await dispatch(op);
                await removeOp(op.key);
                progressed = true;
            } catch (err) {
                if (isPermanent(err)) {
                    await removeOp(op.key);
                    progressed = true;
                    continue;
                }
                setStatus("error");
                scheduleRetry();
                return;
            }
        }
        setStatus("idle");
        backoff = 0;
    } finally {
        draining = false;
    }

    if (progressed) await reconcile();
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
