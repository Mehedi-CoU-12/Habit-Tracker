import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { HabitWithStats } from "../lib/types";
import { nextDueLabel, scheduleLabel } from "../lib/schedule";
import Icon from "./Icon";
import { Card } from "./primitives";

/** A resting habit: everything the due row shows, minus the ability to act. */
function RestRow({
    h,
    now,
    onOpen,
    last,
}: {
    h: HabitWithStats;
    now: Date;
    onOpen: (id: string) => void;
    last?: boolean;
}) {
    const th = useTheme();
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
                borderBottomWidth: last ? 0 : 1.5,
                borderBottomColor: th.bg,
            }}
        >
            <View
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: th.line,
                }}
            >
                <Icon
                    name={h.icon}
                    size={18}
                    stroke={th.muted}
                    strokeWidth={1.8}
                />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: 15 * th.d.font,
                        fontFamily: th.sansBold,
                        color: th.ink2,
                    }}
                >
                    {h.name}
                </Text>
                <Text style={{ fontSize: 11.5, color: th.muted, marginTop: 1 }}>
                    {scheduleLabel(h.daysOfWeek)} · back{" "}
                    {nextDueLabel(h.daysOfWeek, now)}
                </Text>
            </View>

            <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
                <Icon
                    name="flame"
                    size={13}
                    stroke={th.muted}
                    fill={th.muted}
                    strokeWidth={1.2}
                />
                <Text
                    style={{
                        fontSize: 12,
                        fontFamily: th.sansBold,
                        color: th.muted,
                    }}
                >
                    {h.streak}
                </Text>
            </View>
        </Pressable>
    );
}

/**
 * The habits that exist but aren't due today. Collapsed by default: Today is a
 * list of what you can act on, and these can't be — but they shouldn't vanish
 * without a trace either. Tapping one opens its detail screen, where an
 * off-day can still be logged deliberately.
 */
export default function NotToday({
    habits,
    now,
    onOpen,
}: {
    habits: HabitWithStats[];
    now: Date;
    onOpen: (id: string) => void;
}) {
    const th = useTheme();
    const [open, setOpen] = useState(false);

    if (habits.length === 0) return null;

    return (
        <View style={{ paddingHorizontal: th.d.pad, marginTop: 22 }}>
            <Pressable
                onPress={() => setOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`Not today, ${habits.length} ${
                    habits.length === 1 ? "habit" : "habits"
                }`}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 10,
                    marginBottom: 2,
                }}
            >
                <Icon
                    name="moon"
                    size={15}
                    stroke={th.muted}
                    strokeWidth={1.8}
                />
                <Text
                    style={{
                        fontSize: 13,
                        fontFamily: th.sansBold,
                        color: th.muted,
                    }}
                >
                    Not today · {habits.length}
                </Text>
                <View
                    style={{
                        transform: [{ rotate: open ? "90deg" : "0deg" }],
                    }}
                >
                    <Icon
                        name="chevronRight"
                        size={14}
                        stroke={th.muted}
                        strokeWidth={2}
                    />
                </View>
            </Pressable>

            {open && (
                <Card pad={6}>
                    {habits.map((h, i) => (
                        <RestRow
                            key={h.id}
                            h={h}
                            now={now}
                            onOpen={onOpen}
                            last={i === habits.length - 1}
                        />
                    ))}
                </Card>
            )}
        </View>
    );
}
