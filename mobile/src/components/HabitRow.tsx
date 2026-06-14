import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { HabitWithStats } from "../lib/types";
import Icon from "./Icon";
import { Sparkles } from "./primitives";

export function RoutineHeader({
    icon,
    label,
    count,
    total,
}: {
    icon: string;
    label: string;
    count: number;
    total: number;
}) {
    const th = useTheme();
    const done = count === total && total > 0;
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name={icon} size={18} stroke={th.accent} strokeWidth={1.8} />
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 22 * th.d.font,
                        color: th.ink,
                    }}
                >
                    {label}
                </Text>
            </View>
            <View
                style={{
                    backgroundColor: done ? th.greenSoft : th.surface2,
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                }}
            >
                <Text
                    style={{
                        fontSize: 11,
                        fontFamily: th.sansBold,
                        color: done ? th.greenDeep : th.muted,
                    }}
                >
                    {count}/{total}
                    {done ? " ✓" : ""}
                </Text>
            </View>
        </View>
    );
}

export function HabitRow({
    h,
    onToggle,
    onOpen,
    last,
}: {
    h: HabitWithStats;
    onToggle: (id: string) => void;
    onOpen: (id: string) => void;
    last?: boolean;
}) {
    const th = useTheme();
    const [sparkle, setSparkle] = useState(false);

    const handleToggle = () => {
        if (!h.doneToday) {
            setSparkle(true);
            setTimeout(() => setSparkle(false), 700);
        }
        onToggle(h.id);
    };

    return (
        <Pressable
            onPress={() => onOpen(h.id)}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: th.d.rowPad,
                paddingHorizontal: 12,
                margin: 2,
                borderRadius: th.d.radius - 6,
                backgroundColor: h.doneToday ? th.greenSoft : "transparent",
                borderBottomWidth: last ? 0 : 1.5,
                borderBottomColor: th.bg,
            }}
        >
            <View>
                <Pressable
                    onPress={handleToggle}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: h.doneToday ? th.green : "transparent",
                        borderWidth: h.doneToday ? 0 : 2,
                        borderColor: th.accent,
                    }}
                >
                    {h.doneToday ? (
                        <Icon name="check" size={19} stroke="#fff" strokeWidth={2.6} />
                    ) : (
                        <Icon name={h.icon} size={18} stroke={th.deep} strokeWidth={1.8} />
                    )}
                </Pressable>
                <Sparkles show={sparkle} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: 15 * th.d.font,
                        fontFamily: th.sansBold,
                        color: th.ink,
                    }}
                >
                    {h.name}
                </Text>
                <Text style={{ fontSize: 11.5, color: th.muted, marginTop: 1 }}>
                    {h.verb ?? `${h.completed}/${h.goal} this month`}
                </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="flame" size={13} stroke={th.accent} fill={th.accent} strokeWidth={1.2} />
                <Text style={{ fontSize: 12, fontFamily: th.sansBold, color: th.accent }}>
                    {h.streak}
                </Text>
            </View>
        </Pressable>
    );
}
