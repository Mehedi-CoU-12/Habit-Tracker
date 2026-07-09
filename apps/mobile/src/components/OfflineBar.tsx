import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useSyncView } from "../offline/useSyncView";
import { runSync } from "../offline/sync";

/**
 * Persistent connectivity + error bar — a slim full-width overlay at the very
 * top. Shown ONLY for states the user needs to know about or act on: offline
 * (with or without a local queue) and a stalled sync. It never flashes, because
 * these states are inherently steady. Transient "syncing"/"saved" feedback is
 * handled by the ambient <SyncPill/>, not here, so a quick online write shows
 * nothing at all.
 */
export default function OfflineBar() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const view = useSyncView();

    if (view.kind !== "offline" && view.kind !== "error") return null;

    // Calm, reassuring copy — the change is always safe on the device, and a
    // transient error just means we'll keep retrying (with backoff) on our own.
    const text =
        view.kind === "offline"
            ? view.pending > 0
                ? `Offline · ${view.pending} change${view.pending === 1 ? "" : "s"} saved on this device`
                : "You're offline · changes will sync when you reconnect"
            : "Couldn't sync · we'll keep trying · Retry";

    const containerStyle = {
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        paddingTop: insets.top + 4,
        paddingBottom: 6,
        paddingHorizontal: 16,
        backgroundColor: th.muted,
        alignItems: "center" as const,
    };

    const label = (
        <Text
            style={{ color: "#fff", fontSize: 12.5, fontFamily: th.sansBold }}
            numberOfLines={1}
        >
            {text}
        </Text>
    );

    // The error bar is tappable to force an immediate retry; the offline bar is
    // purely informational (there's nothing to retry until connectivity returns).
    if (view.kind === "error") {
        return (
            <Pressable style={containerStyle} onPress={() => void runSync()}>
                {label}
            </Pressable>
        );
    }
    return <View style={containerStyle}>{label}</View>;
}
