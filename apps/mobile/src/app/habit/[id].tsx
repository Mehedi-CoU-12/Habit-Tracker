import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import {
    useHabits,
    useHabitsHistory,
    useToggleLog,
    useDeleteHabit,
} from "../../api/hooks";
import { deriveHabitStats, daysInMonth } from "../../lib/deriveStats";
import {
    HEAT_PERIODS,
    HeatPeriod,
    buildHabitHeatmap,
    habitHistoryStats,
    monthsForHeat,
} from "../../lib/heatmap";
import {
    SkyWash,
    Card,
    Pill,
    Segmented,
    Sparkles,
} from "../../components/primitives";
import Plant from "../../components/Plant";
import Icon from "../../components/Icon";
import Heatmap from "../../components/Heatmap";

const PERIOD_CAPTION: Record<HeatPeriod, string> = {
    Week: "Last 7 days · tap a day",
    Month: "This month · tap a day",
    Year: "This year · tap a day",
};

export default function DetailScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dim = daysInMonth(year, month);

    const { data: raw = [] } = useHabits(year, month);
    const toggle = useToggleLog(year, month);
    const del = useDeleteHabit(year, month);
    const [sparkle, setSparkle] = useState(false);
    const [period, setPeriod] = useState<HeatPeriod>("Month");

    const apiHabit = raw.find((h) => h.id === id);
    const h = apiHabit
        ? deriveHabitStats(apiHabit, year, month, dim, now)
        : null;

    // A floor of 3 months keeps the header's streak/best honest even in the
    // Week view, where the grid itself only needs one.
    const history = useHabitsHistory(
        now,
        Math.max(3, monthsForHeat(period, now)),
    );
    const heat = useMemo(
        () =>
            buildHabitHeatmap(
                history,
                id ?? "",
                period,
                now,
                apiHabit?.createdAt,
            ),
        [history, id, period, now, apiHabit?.createdAt],
    );
    const overall = useMemo(
        () => habitHistoryStats(history, id ?? "", now, apiHabit?.createdAt),
        [history, id, now, apiHabit?.createdAt],
    );

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    if (!h) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: th.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                }}
            >
                <Text style={{ color: th.muted }}>Habit not found.</Text>
                <Pill label="Back to garden" onPress={goBack} />
            </View>
        );
    }

    const handleCheck = () => {
        if (!h.doneToday) {
            setSparkle(true);
            setTimeout(() => setSparkle(false), 700);
        }
        toggle.mutate({ habitId: h.id, day: now.getDate() });
    };

    const confirmDelete = () => {
        Alert.alert("Delete habit", `Remove "${h.name}" and its history?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => del.mutate(h.id, { onSuccess: goBack }),
            },
        ]);
    };

    const stage =
        overall.streak >= 25
            ? "in full bloom"
            : overall.streak >= 10
              ? "growing well"
              : "sprouting";

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={340} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* top bar */}
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingHorizontal: th.d.pad,
                    }}
                >
                    <Pressable
                        onPress={goBack}
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: th.line,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icon name="chevronLeft" size={18} stroke={th.ink} />
                    </Pressable>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: "/add",
                                    params: { id: h.id },
                                })
                            }
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: th.surface,
                                borderWidth: 1.5,
                                borderColor: th.line,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Icon name="pen" size={16} stroke={th.ink} />
                        </Pressable>
                        <Pressable
                            onPress={confirmDelete}
                            accessibilityLabel="Delete habit"
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: th.dangerSoft,
                                borderWidth: 1.5,
                                borderColor: th.danger,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Icon
                                name="trash"
                                size={17}
                                stroke={th.danger}
                                strokeWidth={1.8}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* hero */}
                <View style={{ alignItems: "center", marginTop: 8 }}>
                    <View>
                        <Plant
                            streak={overall.streak}
                            doneToday={h.doneToday}
                            size={176}
                        />
                        <Sparkles show={sparkle} />
                    </View>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 34 * th.d.font,
                            color: th.ink,
                            marginTop: 4,
                        }}
                    >
                        {h.name}
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 6,
                        }}
                    >
                        <Icon
                            name="flame"
                            size={14}
                            stroke={th.accent}
                            fill={th.accent}
                            strokeWidth={1.2}
                        />
                        <Text
                            style={{
                                fontFamily: th.sansBold,
                                color: th.accent,
                                fontSize: 13,
                            }}
                        >
                            {overall.streak} day streak
                        </Text>
                        <Text style={{ color: th.muted, fontSize: 13 }}>
                            · {stage}
                        </Text>
                    </View>
                </View>

                {/* done button */}
                <View style={{ marginHorizontal: th.d.pad, marginTop: 22 }}>
                    <Pressable
                        onPress={handleCheck}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            paddingVertical: 16,
                            borderRadius: th.d.radius,
                            backgroundColor: h.doneToday
                                ? th.greenSoft
                                : th.accent,
                            borderWidth: h.doneToday ? 1.5 : 0,
                            borderColor: th.green,
                        }}
                    >
                        <Icon
                            name="check"
                            size={20}
                            stroke={h.doneToday ? th.greenDeep : "#fff"}
                            strokeWidth={2.4}
                        />
                        <Text
                            style={{
                                fontFamily: th.sansBold,
                                fontSize: 16,
                                color: h.doneToday ? th.greenDeep : "#fff",
                            }}
                        >
                            {h.doneToday
                                ? "Done today — tap to undo"
                                : "Mark as done today"}
                        </Text>
                    </Pressable>
                    <Pill
                        icon="sun"
                        label="Start a focus session"
                        onPress={() =>
                            router.push({
                                pathname: "/focus",
                                params: { habit: h.id },
                            })
                        }
                        style={{ marginTop: 10 }}
                    />
                </View>

                {/* stats */}
                <View
                    style={{
                        flexDirection: "row",
                        gap: 8,
                        marginHorizontal: th.d.pad,
                        marginTop: 16,
                    }}
                >
                    {[
                        { v: `${overall.streak}`, l: "streak", c: th.accent },
                        { v: `${overall.best}`, l: "best", c: th.green },
                        { v: `${overall.completed}`, l: "days", c: th.sky },
                    ].map((s, i) => (
                        <Card
                            key={i}
                            pad={14}
                            style={{ flex: 1, alignItems: "center" }}
                        >
                            <Text
                                style={{
                                    fontFamily: th.display,
                                    fontSize: 26,
                                    color: s.c,
                                    lineHeight: 28,
                                }}
                            >
                                {s.v}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 10.5,
                                    color: th.muted,
                                    fontFamily: th.sansBold,
                                    letterSpacing: 0.6,
                                    marginTop: 6,
                                    textTransform: "uppercase",
                                }}
                            >
                                {s.l}
                            </Text>
                        </Card>
                    ))}
                </View>

                {/* heatmap */}
                <View style={{ marginHorizontal: th.d.pad, marginTop: 22 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                        }}
                    >
                        {/* Short heading: the segmented control needs ~155px
                            of the row, and Caprasimo runs wide. */}
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 20 * th.d.font,
                                color: th.ink,
                            }}
                            numberOfLines={1}
                        >
                            Your story
                        </Text>
                        <Segmented
                            compact
                            options={HEAT_PERIODS}
                            value={period}
                            onChange={setPeriod}
                        />
                    </View>
                    <Card pad={14}>
                        <View
                            style={{
                                flexDirection: "row",
                                marginBottom: 14,
                            }}
                        >
                            {[
                                {
                                    v: `${heat.summary.rate}%`,
                                    l: "completion",
                                },
                                {
                                    v: `${heat.summary.completed}/${heat.summary.expected}`,
                                    l: "days done",
                                },
                                { v: `${heat.summary.best}`, l: "best run" },
                            ].map((s, i) => (
                                <View key={i} style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            fontFamily: th.sansBold,
                                            fontSize: 17,
                                            color: th.ink,
                                        }}
                                    >
                                        {s.v}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 10.5,
                                            color: th.muted,
                                            fontFamily: th.sansBold,
                                            letterSpacing: 0.4,
                                            marginTop: 2,
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {s.l}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        <Heatmap
                            grid={heat.grid}
                            legend={["Missed", "Streak"]}
                            caption={PERIOD_CAPTION[period]}
                        />
                    </Card>
                </View>
            </ScrollView>
        </View>
    );
}
