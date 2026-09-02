import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { HabitWithStats } from "../lib/types";
import { scheduleLabel } from "../lib/schedule";
import Icon from "./Icon";
import { Pill } from "./primitives";

type Actions = {
    onClose: () => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
};

export default function HabitSheet({
    habit,
    ...actions
}: { habit: HabitWithStats | null } & Actions) {
    return (
        <Modal
            visible={!!habit}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={actions.onClose}
        >
            {habit ? <Sheet key={habit.id} h={habit} {...actions} /> : null}
        </Modal>
    );
}

function Sheet({
    h,
    onClose,
    onArchive,
    onDelete,
}: { h: HabitWithStats } & Actions) {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const [confirming, setConfirming] = useState(false);
    const rise = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(rise, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [rise]);

    return (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: th.overlay }}
            />
            <Animated.View
                style={{
                    backgroundColor: th.surface,
                    borderTopLeftRadius: th.d.radius + 6,
                    borderTopRightRadius: th.d.radius + 6,
                    borderWidth: 1.5,
                    borderBottomWidth: 0,
                    borderColor: th.line,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: insets.bottom + 16,
                    opacity: rise,
                    transform: [
                        {
                            translateY: rise.interpolate({
                                inputRange: [0, 1],
                                outputRange: [36, 0],
                            }),
                        },
                    ],
                }}
            >
                <View
                    style={{
                        alignSelf: "center",
                        width: 44,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: th.line,
                        marginBottom: 16,
                    }}
                />

                <Identity h={h} />

                <View
                    style={{
                        height: 1.5,
                        backgroundColor: th.line,
                        marginTop: 16,
                        marginBottom: 6,
                    }}
                />

                {confirming ? (
                    <>
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 21 * th.d.font,
                                color: th.ink,
                                marginTop: 8,
                            }}
                        >
                            Delete this habit?
                        </Text>
                        <View
                            style={{
                                backgroundColor: th.dangerSoft,
                                borderRadius: 14,
                                padding: 14,
                                marginTop: 10,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13.5,
                                    color: th.ink2,
                                    lineHeight: 20,
                                }}
                            >
                                “{h.name}” and every check-in you have logged
                                for it go for good — there is no undo. Archiving
                                keeps all of it and just clears it off Today.
                            </Text>
                        </View>
                        <Pill
                            primary
                            danger
                            icon="trash"
                            label="Delete forever"
                            onPress={() => onDelete(h.id)}
                            style={{ marginTop: 14 }}
                        />
                        <Pill
                            icon="archive"
                            label="Archive instead"
                            onPress={() => onArchive(h.id)}
                            style={{ marginTop: 8 }}
                        />
                        <Cancel label="Cancel" onPress={onClose} />
                    </>
                ) : (
                    <>
                        <Action
                            icon="archive"
                            label="Archive"
                            desc="Clears it off Today and keeps its history."
                            onPress={() => onArchive(h.id)}
                        />
                        <Action
                            icon="trash"
                            label="Delete"
                            desc="Removes the habit and every check-in."
                            danger
                            onPress={() => setConfirming(true)}
                        />
                        <Cancel label="Cancel" onPress={onClose} />
                    </>
                )}
            </Animated.View>
        </View>
    );
}

/** Which habit you are holding — the same icon, name and streak as its row. */
function Identity({ h }: { h: HabitWithStats }) {
    const th = useTheme();
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
                style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: th.accentSoftBg,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icon
                    name={h.icon}
                    size={22}
                    stroke={th.deep}
                    strokeWidth={1.8}
                />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontFamily: th.display,
                        fontSize: 21 * th.d.font,
                        color: th.ink,
                    }}
                >
                    {h.name}
                </Text>
                <Text style={{ fontSize: 12, color: th.muted, marginTop: 1 }}>
                    {scheduleLabel(h.daysOfWeek)} · {h.completed}/{h.goal} this
                    month
                </Text>
            </View>

            {h.streak > 0 && (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: th.accentSoftBg,
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                    }}
                >
                    <Icon
                        name="flame"
                        size={13}
                        stroke={th.deep}
                        fill={th.deep}
                        strokeWidth={1.2}
                    />
                    <Text
                        style={{
                            fontSize: 12,
                            fontFamily: th.sansBold,
                            color: th.deep,
                        }}
                    >
                        {h.streak}
                    </Text>
                </View>
            )}
        </View>
    );
}

/** One menu choice: tinted glyph, label, and what it actually does. */
function Action({
    icon,
    label,
    desc,
    danger,
    onPress,
}: {
    icon: string;
    label: string;
    desc: string;
    danger?: boolean;
    onPress: () => void;
}) {
    const th = useTheme();
    const tint = danger ? th.danger : th.deep;
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 12,
                paddingHorizontal: 10,
                marginTop: 4,
                borderRadius: th.d.radius - 6,
                backgroundColor: pressed
                    ? danger
                        ? th.dangerSoft
                        : th.surface2
                    : "transparent",
            })}
        >
            <View
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: danger ? th.dangerSoft : th.accentSoftBg,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icon name={icon} size={19} stroke={tint} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    style={{
                        fontSize: 15 * th.d.font,
                        fontFamily: th.sansBold,
                        color: danger ? th.danger : th.ink,
                    }}
                >
                    {label}
                </Text>
                <Text style={{ fontSize: 12, color: th.muted, marginTop: 2 }}>
                    {desc}
                </Text>
            </View>
        </Pressable>
    );
}

/** The way out, weighted like UpdateGate's "Not now" — present, not loud. */
function Cancel({ label, onPress }: { label: string; onPress: () => void }) {
    const th = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={{ paddingVertical: 14, marginTop: 6 }}
        >
            <Text
                style={{
                    textAlign: "center",
                    fontSize: 14,
                    fontFamily: th.sansBold,
                    color: th.muted,
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}
