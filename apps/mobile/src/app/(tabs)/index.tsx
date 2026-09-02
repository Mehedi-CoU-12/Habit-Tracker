import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBloom, useTheme } from "../../theme/ThemeProvider";
import {
    useDeleteHabit,
    useHabits,
    useToggleLog,
    useUpdateHabit,
} from "../../api/hooks";
import { useOnline } from "../../offline/hooks";
import { deriveHabitStats, daysInMonth } from "../../lib/deriveStats";
import { HabitWithStats, Tod } from "../../lib/types";
import { dayNamesFull, monthShort } from "../../lib/date";
import { SkyWash, Card } from "../../components/primitives";
import { HabitRow, RoutineHeader } from "../../components/HabitRow";
import Plant from "../../components/Plant";
import Icon from "../../components/Icon";
import HabitSheet from "../../components/HabitSheet";

const ROUTINES: { tod: Tod; icon: string; label: string }[] = [
    { tod: "morning", icon: "sun", label: "Morning" },
    { tod: "afternoon", icon: "cloud", label: "Afternoon" },
    { tod: "evening", icon: "moonStars", label: "Evening" },
    { tod: "anytime", icon: "sparkle", label: "Anytime" },
];

export default function TodayScreen() {
    const th = useTheme();
    const { layout } = useBloom();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dim = daysInMonth(year, month);

    const { data: raw = [], isLoading, isError } = useHabits(year, month);
    const online = useOnline();
    const toggle = useToggleLog(year, month);
    const del = useDeleteHabit(year, month);
    const update = useUpdateHabit(year, month);

    const all: HabitWithStats[] = useMemo(
        () => raw.map((h) => deriveHabitStats(h, year, month, dim, now)),
        [raw, year, month, dim, now],
    );

    // An archived habit is off this screen entirely; a habit that isn't due
    // today is off it just for today. Both still exist in Stats and history.
    const active = useMemo(() => all.filter((h) => !h.archivedAt), [all]);
    const habits = useMemo(
        () => active.filter((h) => h.scheduledToday),
        [active],
    );
    /** Habits exist, but none of them are due today. */
    const restDay = active.length > 0 && habits.length === 0;

    const done = habits.filter((h) => h.doneToday).length;
    const open = (id: string) =>
        router.push({ pathname: "/habit/[id]", params: { id } });

    /** The habit being held, read back out of `habits` so one that leaves the
        list — archived, deleted — takes its sheet with it. */
    const [heldId, setHeldId] = useState<string | null>(null);
    const held = useMemo(
        () => habits.find((h) => h.id === heldId) ?? null,
        [habits, heldId],
    );

    /** Archive leads in the sheet, because it's the one that's reversible.
        Deleting keeps its own confirm step in there: it cannot be undone. */
    const archive = (id: string) => {
        setHeldId(null);
        update.mutate({ id, input: { archived: true } });
    };
    const remove = (id: string) => {
        setHeldId(null);
        del.mutate(id);
    };

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={300} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 120,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* sun */}
                <View
                    style={{
                        position: "absolute",
                        top: insets.top + 30,
                        right: 32,
                        width: 54,
                        height: 54,
                        borderRadius: 27,
                        backgroundColor: th.sun,
                        opacity: 0.85,
                    }}
                />

                <View style={{ paddingHorizontal: th.d.pad }}>
                    <Text
                        style={{
                            fontSize: 12,
                            color: th.ink2,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.5,
                        }}
                    >
                        {dayNamesFull[now.getDay()]!.toUpperCase()} ·{" "}
                        {monthShort[month - 1]!.toUpperCase()} {now.getDate()}
                    </Text>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 36 * th.d.font,
                            color: th.ink,
                            marginTop: 6,
                        }}
                    >
                        Your garden, today
                    </Text>
                    <Text
                        style={{ fontSize: 14, color: th.ink2, marginTop: 4 }}
                    >
                        {done} of {habits.length} watered ☿
                    </Text>
                    {habits.length > 0 && (
                        <Pressable
                            onPress={() => router.push("/focus")}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                alignSelf: "flex-start",
                                gap: 7,
                                marginTop: 14,
                                paddingVertical: 9,
                                paddingHorizontal: 16,
                                borderRadius: 20,
                                backgroundColor: th.surface,
                                borderWidth: 1.5,
                                borderColor: th.line,
                            }}
                        >
                            <Icon
                                name="sun"
                                size={16}
                                stroke={th.accent}
                                strokeWidth={1.8}
                            />
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontFamily: th.sansBold,
                                    color: th.ink,
                                }}
                            >
                                Focus
                            </Text>
                        </Pressable>
                    )}
                </View>

                {isLoading && (
                    <ActivityIndicator
                        color={th.accent}
                        style={{ marginTop: 60 }}
                    />
                )}

                {/* Only a genuine online failure is an API error. While offline
                    the query is paused (not failed), so this must be gated on
                    `online` — otherwise a cold-start-offline error would show
                    "pull the API up" instead of the offline state below. */}
                {isError && online && (
                    <Card style={{ margin: th.d.pad }}>
                        <Text style={{ color: th.ink2, textAlign: "center" }}>
                            Couldn&apos;t load your habits. Pull the API up and
                            check EXPO_PUBLIC_API_URL.
                        </Text>
                    </Card>
                )}

                {/* Offline with nothing cached yet — reassure rather than showing
                    the API error or a misleading "garden is empty". */}
                {!online && !isLoading && habits.length === 0 && (
                    <Card
                        style={{
                            margin: th.d.pad,
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Plant streak={0} doneToday size={96} />
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 20,
                                color: th.ink,
                            }}
                        >
                            You&apos;re offline
                        </Text>
                        <Text style={{ color: th.muted, textAlign: "center" }}>
                            Your habits will appear here once you reconnect.
                            Anything you change now is saved on this device and
                            syncs automatically.
                        </Text>
                    </Card>
                )}

                {online && !isLoading && !isError && active.length === 0 && (
                    <Card
                        style={{
                            margin: th.d.pad,
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Plant streak={0} doneToday size={96} />
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 20,
                                color: th.ink,
                            }}
                        >
                            Your garden is empty
                        </Text>
                        <Text style={{ color: th.muted, textAlign: "center" }}>
                            Tap + to plant your first habit.
                        </Text>
                    </Card>
                )}

                {/* Habits exist but none are due today — a scheduled rest day
                    is a success state, not an empty one. */}
                {!isLoading && restDay && (
                    <Card
                        style={{
                            margin: th.d.pad,
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Plant streak={3} doneToday size={96} />
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 20,
                                color: th.ink,
                            }}
                        >
                            Nothing due today
                        </Text>
                        <Text style={{ color: th.muted, textAlign: "center" }}>
                            Rest is part of the schedule. Your habits are back
                            on their next day.
                        </Text>
                    </Card>
                )}

                {/* Garden grid */}
                {layout === "garden" && habits.length > 0 && (
                    <View
                        style={{
                            marginTop: 12,
                            paddingHorizontal: 12,
                            flexDirection: "row",
                            flexWrap: "wrap",
                        }}
                    >
                        {habits.map((h) => (
                            <Pressable
                                key={h.id}
                                onPress={() => open(h.id)}
                                onLongPress={() => setHeldId(h.id)}
                                style={{
                                    width: "33.33%",
                                    alignItems: "center",
                                    paddingVertical: 6,
                                }}
                            >
                                <Plant
                                    streak={h.streak}
                                    doneToday={h.doneToday}
                                    size={84 * th.d.plant}
                                />
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        fontSize: 11.5,
                                        fontFamily: th.sansBold,
                                        color: th.ink,
                                        marginTop: -2,
                                    }}
                                >
                                    {h.name}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 10,
                                        color: th.muted,
                                        marginTop: 2,
                                    }}
                                >
                                    {h.streak}d
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* Routine sections */}
                <View
                    style={{
                        paddingHorizontal: th.d.pad,
                        paddingTop: layout === "garden" ? 24 : 16,
                        gap: 22,
                    }}
                >
                    {ROUTINES.map(({ tod, icon, label }) => {
                        const list = habits.filter((h) => h.tod === tod);
                        if (list.length === 0) return null;
                        const c = list.filter((h) => h.doneToday).length;
                        return (
                            <View key={tod}>
                                <RoutineHeader
                                    icon={icon}
                                    label={label}
                                    count={c}
                                    total={list.length}
                                />
                                <Card pad={6}>
                                    {list.map((h, i) => (
                                        <HabitRow
                                            key={h.id}
                                            h={h}
                                            onToggle={(id) =>
                                                toggle.mutate({
                                                    habitId: id,
                                                    day: now.getDate(),
                                                })
                                            }
                                            onOpen={open}
                                            onLongPress={setHeldId}
                                            last={i === list.length - 1}
                                        />
                                    ))}
                                </Card>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            <HabitSheet
                habit={held}
                onClose={() => setHeldId(null)}
                onArchive={archive}
                onDelete={remove}
            />
        </View>
    );
}
