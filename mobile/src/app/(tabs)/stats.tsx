import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import { hexA } from "../../theme/tokens";
import { useHabits } from "../../api/hooks";
import { deriveHabitStats, daysInMonth } from "../../lib/deriveStats";
import { buildYearData } from "../../lib/date";
import { Tod } from "../../lib/types";
import { SkyWash, Card } from "../../components/primitives";

function Heatmap() {
    const th = useTheme();
    const cells = useMemo(() => buildYearData(3), []);
    return (
        <Svg viewBox="0 0 312 90" width="100%" height={90}>
            {cells.map((c) => (
                <Rect
                    key={`${c.week}-${c.day}`}
                    x={c.week * 12}
                    y={c.day * 12}
                    width={10}
                    height={10}
                    rx={3}
                    fill={c.level === 0 ? th.surface2 : th.green}
                    opacity={c.level === 0 ? (th.dark ? 0.4 : 0.5) : 0.4 + c.level * 0.16}
                />
            ))}
        </Svg>
    );
}

export default function StatsScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dim = daysInMonth(year, month);
    const [period, setPeriod] = useState("Month");

    const { data: raw = [] } = useHabits(year, month);
    const habits = useMemo(
        () => raw.map((h) => deriveHabitStats(h, year, month, dim, now)),
        [raw, year, month, dim, now],
    );

    const avgRate = habits.length
        ? Math.round(habits.reduce((s, h) => s + h.rate, 0) / habits.length)
        : 0;

    const byTod = (tod: Tod) => {
        const list = habits.filter((h) => h.tod === tod);
        if (!list.length) return 0;
        return Math.round(list.reduce((s, h) => s + h.rate, 0) / list.length) / 100;
    };

    const bars = [
        { l: "Morning", v: byTod("morning"), c: th.accent },
        { l: "Afternoon", v: byTod("afternoon"), c: th.sky },
        { l: "Evening", v: byTod("evening"), c: th.green },
    ];

    const ranked = [...habits].sort((a, b) => b.rate - a.rate).slice(0, 5);

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={140} />
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={{
                        paddingHorizontal: th.d.pad,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Text style={{ fontFamily: th.display, fontSize: 32 * th.d.font, color: th.ink }}>
                        Insights
                    </Text>
                    <View style={{ flexDirection: "row", gap: 3, backgroundColor: th.surface2, borderRadius: 11, padding: 3 }}>
                        {["Week", "Month", "Year"].map((p) => (
                            <Pressable
                                key={p}
                                onPress={() => setPeriod(p)}
                                style={{
                                    paddingVertical: 6,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    backgroundColor: period === p ? th.surface : "transparent",
                                }}
                            >
                                <Text style={{ fontSize: 12, fontFamily: th.sansBold, color: period === p ? th.ink : th.muted }}>
                                    {p}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={{ paddingHorizontal: th.d.pad, paddingTop: 20, gap: 16 }}>
                    {/* hero completion */}
                    <View
                        style={{
                            backgroundColor: th.accent,
                            borderRadius: th.d.radius,
                            padding: 22,
                            overflow: "hidden",
                        }}
                    >
                        <View
                            style={{
                                position: "absolute",
                                top: -30,
                                right: -30,
                                width: 140,
                                height: 140,
                                borderRadius: 70,
                                backgroundColor: th.sun,
                                opacity: 0.4,
                            }}
                        />
                        <Text style={{ fontSize: 11, fontFamily: th.sansBold, letterSpacing: 1, color: "rgba(255,255,255,0.9)" }}>
                            THIS MONTH
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16, marginTop: 8 }}>
                            <Text style={{ fontFamily: th.display, fontSize: 64, color: "#fff", lineHeight: 64 }}>
                                {avgRate}
                                <Text style={{ fontSize: 26 }}>%</Text>
                            </Text>
                            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, paddingBottom: 10 }}>
                                avg completion{"\n"}across {habits.length} habits
                            </Text>
                        </View>
                    </View>

                    {/* activity heatmap */}
                    <View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                            <Text style={{ fontFamily: th.display, fontSize: 20 * th.d.font, color: th.ink }}>Activity</Text>
                            <Text style={{ fontSize: 11, color: th.muted, fontFamily: th.sansBold }}>6 MONTHS</Text>
                        </View>
                        <Card pad={14}>
                            <Heatmap />
                        </Card>
                    </View>

                    {/* by time of day */}
                    <View>
                        <Text style={{ fontFamily: th.display, fontSize: 20 * th.d.font, color: th.ink, marginBottom: 12 }}>
                            By time of day
                        </Text>
                        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", height: 120 }}>
                            {bars.map((b, i) => (
                                <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                                    <Text style={{ fontSize: 13, fontFamily: th.sansBold, color: th.ink, marginBottom: 6 }}>
                                        {Math.round(b.v * 100)}%
                                    </Text>
                                    <View
                                        style={{
                                            width: "100%",
                                            height: `${Math.max(b.v * 100, 2)}%`,
                                            backgroundColor: b.c,
                                            borderTopLeftRadius: 10,
                                            borderTopRightRadius: 10,
                                        }}
                                    />
                                    <Text style={{ fontSize: 10.5, color: th.muted, fontFamily: th.sansBold, marginTop: 8 }}>
                                        {b.l}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* top growers */}
                    {ranked.length > 0 && (
                        <View>
                            <Text style={{ fontFamily: th.display, fontSize: 20 * th.d.font, color: th.ink, marginBottom: 4 }}>
                                Your strongest
                            </Text>
                            <Text style={{ fontSize: 12.5, color: th.muted, marginBottom: 14 }}>
                                Ranked by completion rate this month.
                            </Text>
                            {ranked.map((h) => (
                                <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1.5, borderBottomColor: th.line }}>
                                    <Text style={{ width: 110, fontSize: 13.5, color: th.ink }} numberOfLines={1}>
                                        {h.name}
                                    </Text>
                                    <View style={{ flex: 1, height: 8, backgroundColor: th.surface2, borderRadius: 4, overflow: "hidden" }}>
                                        <View style={{ width: `${h.rate}%`, height: "100%", backgroundColor: th.accent, borderRadius: 4 }} />
                                    </View>
                                    <Text style={{ fontSize: 12, color: th.muted, fontFamily: th.sansBold, width: 40, textAlign: "right" }}>
                                        {h.rate}%
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
