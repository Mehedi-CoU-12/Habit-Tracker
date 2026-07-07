import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useOnline, usePendingCount, useSyncStatus } from "../offline/hooks";

/**
 * Slim top banner communicating connectivity + sync state. Hidden entirely when
 * online with an empty, idle queue, so it never nags in the normal case. Absolute
 * overlay so it doesn't disturb screen layouts.
 */
export default function OfflineBar() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const online = useOnline();
    const pending = usePendingCount();
    const status = useSyncStatus();

    let text: string | null = null;
    let bg = th.muted;

    if (!online) {
        bg = th.muted;
        text =
            pending > 0
                ? `Offline · ${pending} change${pending === 1 ? "" : "s"} saved locally`
                : "You're offline · changes will sync when you reconnect";
    } else if (status === "syncing") {
        bg = th.accent;
        text =
            pending > 0
                ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
                : "Syncing…";
    } else if (status === "error" && pending > 0) {
        bg = th.muted;
        text = `Sync paused · retrying ${pending} change${pending === 1 ? "" : "s"}`;
    }

    if (!text) return null;

    return (
        <View
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 30,
                paddingTop: insets.top + 4,
                paddingBottom: 6,
                paddingHorizontal: 16,
                backgroundColor: bg,
                alignItems: "center",
            }}
        >
            <Text
                style={{
                    color: "#fff",
                    fontSize: 12.5,
                    fontFamily: th.sansBold,
                }}
                numberOfLines={1}
            >
                {text}
            </Text>
        </View>
    );
}
