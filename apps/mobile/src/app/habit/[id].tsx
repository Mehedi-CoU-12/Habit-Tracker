import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import {
    useHabits,
    useHabitsHistory,
    useToggleLog,
    useSetLogAmount,
    useDeleteHabit,
    useUpdateHabit,
} from "../../api/hooks";
import { isDaily, scheduleLabel } from "../../lib/schedule";
import { isQuantified } from "../../lib/completion";
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
import HabitSheet from "../../components/HabitSheet";
import type { HabitWithStats } from "../../lib/types";

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
    const setAmount = useSetLogAmount(year, month);
    const del = useDeleteHabit(year, month);
    const update = useUpdateHabit(year, month);
    const [sparkle, setSparkle] = useState(false);
    const [period, setPeriod] = useState<HeatPeriod>("Month");
    const [habitPendingDeletion, setHabitPendingDeletion] =
        useState<HabitWithStats | null>(null);
    const [habitPendingArchive, setHabitPendingArchive] =
        useState<HabitWithStats | null>(null);

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
        () => buildHabitHeatmap(history, id ?? "", period, now, apiHabit),
        [history, id, period, now, apiHabit],
    );
    const overall = useMemo(
        () => habitHistoryStats(history, id ?? "", now, apiHabit),
        [history, id, now, apiHabit],
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

    const quantified = isQuantified(h);
    const target = Math.max(1, h.target ?? 1);
    const progress = quantified
        ? Math.min(1, h.todayAmount / target)
        : h.doneToday
          ? 1
          : 0;
    const remaining = Math.max(0, target - h.todayAmount);

    const celebrate = () => {
        setSparkle(true);
        setTimeout(() => setSparkle(false), 700);
    };

    const handleCheck = () => {
        if (h.doneToday) {
            toggle.mutate({ habitId: h.id, day: now.getDate() });
            return;
        }
        if (quantified) {
            if (h.todayAmount + h.step >= target) celebrate();
            setAmount.mutate({
                habitId: h.id,
                day: now.getDate(),
                amount: Math.min(target, h.todayAmount + h.step),
            });
            return;
        }
        celebrate();
        toggle.mutate({ habitId: h.id, day: now.getDate() });
    };

    const archived = !!apiHabit?.archivedAt;

    const toggleArchive = () => {
        if (!h) return;
        if (archived) {
            update.mutate({ id: h.id, input: { archived: false } });
            return;
        }
        setHabitPendingArchive(h);
    };

    const openDeleteSheet = () => setHabitPendingDeletion(h);

    const archiveFromSheet = (habitId: string) => {
        setHabitPendingDeletion(null);
        setHabitPendingArchive(null);
        update.mutate(
            { id: habitId, input: { archived: true } },
            { onSuccess: goBack },
        );
    };

    const deleteFromSheet = (habitId: string) => {
        setHabitPendingDeletion(null);
        del.mutate(habitId, { onSuccess: goBack });
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
                            onPress={toggleArchive}
                            accessibilityLabel={
                                archived ? "Restore habit" : "Archive habit"
                            }
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: archived
                                    ? th.accentSoftBg
                                    : th.surface,
                                borderWidth: 1.5,
                                borderColor: archived ? th.accent : th.line,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Icon
                                name={archived ? "sprout" : "archive"}
                                size={16}
                                stroke={archived ? th.deep : th.ink}
                                strokeWidth={1.8}
                            />
                        </Pressable>
                        <Pressable
                            onPress={openDeleteSheet}
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
                    {(!isDaily(h.daysOfWeek) || archived) && (
                        <Text
                            style={{
                                fontSize: 12,
                                color: th.muted,
                                fontFamily: th.sansBold,
                                marginTop: 6,
                            }}
                        >
                            {[
                                archived ? "Archived" : null,
                                isDaily(h.daysOfWeek)
                                    ? null
                                    : scheduleLabel(h.daysOfWeek),
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </Text>
                    )}
                </View>

                {/* done button */}
                <View style={{ marginHorizontal: th.d.pad, marginTop: 22 }}>
                    {quantified && (
                        <View style={{ marginBottom: 10 }}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                    marginBottom: 6,
                                }}
                            >
                                <Text
                                    style={{
                                        fontFamily: th.sansBold,
                                        fontSize: 13,
                                        color: th.ink,
                                    }}
                                >
                                    {h.todayAmount} / {target}
                                    {h.unit ? ` ${h.unit}` : ""}
                                </Text>
                                <Text style={{ fontSize: 12, color: th.muted }}>
                                    {remaining === 0
                                        ? "target reached"
                                        : `${remaining} to go`}
                                </Text>
                            </View>
                            <View
                                style={{
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: th.surface2,
                                    overflow: "hidden",
                                }}
                            >
                                <View
                                    style={{
                                        width: `${progress * 100}%`,
                                        height: "100%",
                                        borderRadius: 4,
                                        backgroundColor: h.doneToday
                                            ? th.green
                                            : th.accent,
                                    }}
                                />
                            </View>
                        </View>
                    )}
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
                            name={quantified && !h.doneToday ? "plus" : "check"}
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
                                : quantified
                                  ? `Add ${h.step}${h.unit ? ` ${h.unit}` : ""}`
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
            <HabitSheet
                habit={habitPendingDeletion}
                initialView="delete-confirmation"
                onClose={() => setHabitPendingDeletion(null)}
                onArchive={archiveFromSheet}
                onDelete={deleteFromSheet}
            />
            <HabitSheet
                habit={habitPendingArchive}
                initialView="archive-confirmation"
                onClose={() => setHabitPendingArchive(null)}
                onArchive={archiveFromSheet}
                onDelete={deleteFromSheet}
            />
        </View>
    );
}
