import { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    Pressable,
    StyleProp,
    Text,
    TextStyle,
    View,
    ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { hexA } from "../theme/tokens";
import Icon from "./Icon";

/** Card surface with the Bloom border + radius. */
export function Card({
    children,
    style,
    pad,
}: {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    pad?: number;
}) {
    const th = useTheme();
    return (
        <View
            style={[
                {
                    backgroundColor: th.surface,
                    borderColor: th.line,
                    borderWidth: 1.5,
                    borderRadius: th.d.radius,
                    padding: pad ?? th.d.cardPad,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

/** Sky → cream gradient wash placed behind a screen header. */
export function SkyWash({ height = 280 }: { height?: number }) {
    const th = useTheme();
    return (
        <LinearGradient
            colors={[
                hexA(th.sky, th.dark ? 0.18 : 0.33),
                hexA(th.accent, th.dark ? 0.1 : 0.2),
                th.bg,
            ]}
            locations={[0, 0.5, 1]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
            pointerEvents="none"
        />
    );
}

/** Pill button. */
export function Pill({
    label,
    icon,
    primary,
    onPress,
    style,
    textStyle,
}: {
    label: string;
    icon?: string;
    primary?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
}) {
    const th = useTheme();
    const fg = primary ? "#fff" : th.ink;
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 28,
                    paddingVertical: 13,
                    paddingHorizontal: 20,
                    backgroundColor: primary ? th.accent : th.surface,
                    borderWidth: primary ? 0 : 1.5,
                    borderColor: th.line,
                    opacity: pressed ? 0.85 : 1,
                },
                style,
            ]}
        >
            {icon ? (
                <Icon name={icon} size={18} stroke={fg} strokeWidth={2} />
            ) : null}
            <Text
                style={[
                    { color: fg, fontFamily: th.sansBold, fontSize: 15 },
                    textStyle,
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

/** 46×27 toggle switch. */
export function Toggle({ on, onPress }: { on: boolean; onPress?: () => void }) {
    const th = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={{
                width: 46,
                height: 27,
                borderRadius: 14,
                padding: 2,
                backgroundColor: on ? th.accent : th.line,
                flexDirection: "row",
                justifyContent: on ? "flex-end" : "flex-start",
            }}
        >
            <View
                style={{
                    width: 23,
                    height: 23,
                    borderRadius: 12,
                    backgroundColor: "#fff",
                }}
            />
        </Pressable>
    );
}

/** 8-dot sparkle burst that plays once when `show` flips true. */
export function Sparkles({ show, color }: { show: boolean; color?: string }) {
    const th = useTheme();
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (show) {
            anim.setValue(0);
            Animated.timing(anim, {
                toValue: 1,
                duration: 600,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start();
        }
    }, [show, anim]);

    if (!show) return null;
    const c = color ?? th.accent;
    return (
        <View
            pointerEvents="none"
            style={{ position: "absolute", left: "50%", top: "50%" }}
        >
            {Array.from({ length: 8 }).map((_, i) => {
                const ang = (i / 8) * Math.PI * 2;
                const dist = 26;
                return (
                    <Animated.View
                        key={i}
                        style={{
                            position: "absolute",
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: c,
                            transform: [
                                {
                                    translateX: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, Math.cos(ang) * dist],
                                    }),
                                },
                                {
                                    translateY: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0, Math.sin(ang) * dist],
                                    }),
                                },
                                {
                                    scale: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 0],
                                    }),
                                },
                            ],
                            opacity: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 0],
                            }),
                        }}
                    />
                );
            })}
        </View>
    );
}
