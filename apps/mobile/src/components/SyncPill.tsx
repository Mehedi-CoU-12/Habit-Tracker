import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import Icon from "./Icon";
import { useSyncView } from "../offline/useSyncView";

/**
 * Ambient, non-intrusive sync feedback: a small muted pill floating at the top
 * of the screen, near the status area. Shown ONLY when a sync is slow enough to
 * matter (>500ms via useSyncView's debounce) or has just finished. It uses
 * surface/muted colors — never the accent — so it reads as quiet information,
 * not an alert, and it's pointer-transparent so it never blocks the UI beneath.
 */
export default function SyncPill() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const view = useSyncView();

    if (view.kind !== "syncing" && view.kind !== "saved") return null;

    const labelStyle = {
        color: th.ink2,
        fontSize: 12.5,
        fontFamily: th.sansBold,
    };

    let content;
    if (view.kind === "syncing") {
        const text =
            view.pending > 0
                ? `Syncing ${view.pending} change${view.pending === 1 ? "" : "s"}…`
                : "Syncing…";
        content = (
            <>
                <ActivityIndicator size="small" color={th.muted} />
                <Text style={labelStyle}>{text}</Text>
            </>
        );
    } else {
        const text = view.reconnected
            ? "Back online · all changes saved"
            : "All changes saved";
        content = (
            <>
                <Icon
                    name="check"
                    size={14}
                    stroke={th.green}
                    strokeWidth={2.4}
                />
                <Text style={labelStyle}>{text}</Text>
            </>
        );
    }

    return (
        <View
            pointerEvents="none"
            style={{
                position: "absolute",
                top: insets.top + 6,
                left: 0,
                right: 0,
                zIndex: 29,
                alignItems: "center",
            }}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: th.surface,
                    borderWidth: 1,
                    borderColor: th.line,
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                }}
            >
                {content}
            </View>
        </View>
    );
}
