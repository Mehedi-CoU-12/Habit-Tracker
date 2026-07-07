import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";
import { pendingCount, subscribe as subscribeOutbox } from "./outbox";
import { getStatus, subscribeStatus, type SyncStatus } from "./sync";

/** Live online/offline flag, driven by NetInfo → onlineManager. */
export function useOnline(): boolean {
    return useSyncExternalStore(
        (cb) => onlineManager.subscribe(cb),
        () => onlineManager.isOnline(),
        () => true,
    );
}

/** Number of writes waiting to sync. */
export function usePendingCount(): number {
    return useSyncExternalStore(subscribeOutbox, pendingCount, () => 0);
}

/** Current sync worker state. */
export function useSyncStatus(): SyncStatus {
    return useSyncExternalStore(subscribeStatus, getStatus, () => "idle");
}
