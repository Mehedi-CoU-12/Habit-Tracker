import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { CATEGORY, CHANNEL } from "./types";

/** Check current authorization WITHOUT prompting. Used by the reconcile pass. */
export async function hasPermission(): Promise<boolean> {
    const s = await Notifications.getPermissionsAsync();
    return s.granted;
}

/**
 * Prompt for permission if we haven't been permanently denied. Called only from
 * an explicit user action (enabling reminders in settings), never on launch.
 */
export async function requestPermission(): Promise<boolean> {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
}

let setup = false;

/**
 * One-time OS wiring: how notifications present in the foreground, the Android
 * channel, and the "Mark done / Snooze" action category. Idempotent.
 */
export async function setupNotifications(): Promise<void> {
    if (setup) return;
    setup = true;

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });

    await Notifications.setNotificationCategoryAsync(CATEGORY, [
        {
            identifier: "DONE",
            buttonTitle: "Mark done",
            options: { opensAppToForeground: false },
        },
        {
            identifier: "SNOOZE",
            buttonTitle: "Snooze 1h",
            options: { opensAppToForeground: false },
        },
    ]);

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
            name: "Habit reminders",
            // DEFAULT, not HIGH — a gentle nudge, never a full-screen barge-in.
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 120],
        });
    }
}
