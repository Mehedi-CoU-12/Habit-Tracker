import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { enqueue } from "../offline/outbox";
import { runSync } from "../offline/sync";
import { setupNotifications } from "./permissions";
import { loadPrefs } from "./store";
import { markDoneInCache, scheduleSnooze, syncReminders } from "./reminders";

export { syncReminders } from "./reminders";
export { useReminderPrefs } from "./store";
export { requestPermission } from "./permissions";

type ResponseData = { habitIds?: string[]; slot?: string };

async function handleResponse(
    res: Notifications.NotificationResponse,
): Promise<void> {
    const data = (res.notification.request.content.data ?? {}) as ResponseData;
    const habitIds = data.habitIds ?? [];

    if (res.actionIdentifier === "DONE") {
        // Complete every habit in the (coalesced) reminder via the same offline
        // path a tap in-app uses: optimistic cache write + durable outbox op.
        const now = new Date();
        for (const id of habitIds) {
            markDoneInCache(id, now);
            await enqueue({
                kind: "log.set",
                habitId: id,
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                day: now.getDate(),
                completed: true,
            });
        }
        void runSync();
    } else if (res.actionIdentifier === "SNOOZE") {
        await scheduleSnooze(habitIds, data.slot ?? "", 60);
    }
    // A plain tap (DEFAULT action) just opens the app; nothing to do here.

    void syncReminders();
}

let started = false;

/**
 * Wire the reminder triggers once: OS setup, reschedule on every foreground
 * (tops up the horizon, prunes the past, re-evaluates completion + timezone),
 * respond to notification actions, and lay down the initial schedule.
 */
export function startReminders(): void {
    if (started) return;
    if (Platform.OS === "web") return; // notifications unsupported on web
    started = true;

    void setupNotifications();

    AppState.addEventListener("change", (s) => {
        if (s === "active") void syncReminders();
    });

    Notifications.addNotificationResponseReceivedListener((res) => {
        void handleResponse(res);
    });

    void loadPrefs().then(() => syncReminders());
}
