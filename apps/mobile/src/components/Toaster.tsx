import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { dismissToast, Toast, useToasts } from "../lib/toast";
import Icon from "./Icon";

function ToastItem({ toast: t }: { toast: Toast }) {
    const th = useTheme();

    useEffect(() => {
        const timer = setTimeout(() => {
            dismissToast(t.id);
        }, t.duration);
        return () => clearTimeout(timer);
    }, [t.id, t.duration]);

    const isError = t.type === "error";
    const isSuccess = t.type === "success";

    const iconName = isError ? "alertCircle" : isSuccess ? "check" : "sparkle";
    const iconColor = isError ? th.danger : isSuccess ? th.green : th.sun;
    const iconBg = isError
        ? th.dangerSoft
        : isSuccess
          ? th.greenSoft
          : "rgba(230, 184, 92, 0.16)";

    const borderColor = isError ? th.danger : isSuccess ? th.green : th.line;

    return (
        <Pressable
            onPress={() => dismissToast(t.id)}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: th.surface,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor,
                paddingVertical: 10,
                paddingHorizontal: 12,
                marginBottom: 8,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 4,
            }}
        >
            <View
                style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: iconBg,
                }}
            >
                <Icon
                    name={iconName}
                    size={16}
                    stroke={iconColor}
                    strokeWidth={2.2}
                />
            </View>
            <Text
                style={{
                    flex: 1,
                    fontSize: 13,
                    fontFamily: th.sansBold,
                    color: th.ink,
                    lineHeight: 18,
                }}
            >
                {t.message}
            </Text>
            <Pressable
                onPress={() => dismissToast(t.id)}
                hitSlop={8}
                style={{ padding: 4 }}
            >
                <Icon name="x" size={14} stroke={th.muted} strokeWidth={2.4} />
            </Pressable>
        </Pressable>
    );
}

export default function Toaster() {
    const insets = useSafeAreaInsets();
    const items = useToasts();

    if (items.length === 0) return null;

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: "absolute",
                top: insets.top + 8,
                left: 16,
                right: 16,
                zIndex: 9999,
            }}
        >
            {items.map((t) => (
                <ToastItem key={t.id} toast={t} />
            ))}
        </View>
    );
}
