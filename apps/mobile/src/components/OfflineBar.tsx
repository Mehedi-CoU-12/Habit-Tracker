import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useSyncView } from "../offline/useSyncView";
import { runSync } from "../offline/sync";

export default function OfflineBar() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const view = useSyncView();

    if (view.kind !== "offline" && view.kind !== "error") return null;

    const text =
        view.kind === "offline"
            ? view.pending > 0
                ? `Offline · ${view.pending} change${view.pending === 1 ? "" : "s"} saved on this device`
                : "You're offline · changes will sync when you reconnect"
            : "Couldn't sync · we'll keep trying · ";

    const containerStyle = {
        paddingTop: insets.top + 5,
        paddingBottom: 7,
        paddingHorizontal: 16,
        backgroundColor: th.dark ? th.dirt : th.ink2,
        alignItems: "center" as const,
    };

    const label = (
        <Text
            style={{ color: "#fff", fontSize: 12.5, fontFamily: th.sansBold }}
            numberOfLines={1}
        >
            {text}
            {view.kind === "error" && (
                <Text style={{ textDecorationLine: "underline" }}>Retry</Text>
            )}
        </Text>
    );

    if (view.kind === "error") {
        return (
            <Pressable style={containerStyle} onPress={() => void runSync()}>
                {label}
            </Pressable>
        );
    }
    return <View style={containerStyle}>{label}</View>;
}
