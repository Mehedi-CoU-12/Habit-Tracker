import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import { useHabits } from "../../api/hooks";
import { daysInMonth } from "../../lib/deriveStats";
import { dayNames, monthNames } from "../../lib/date";
import { SkyWash, Card } from "../../components/primitives";
import Icon from "../../components/Icon";

function Ring({ pct, label, today }: { pct: number; label: number; today: boolean }) {
    const th = useTheme();
    const r = 16;
    const circ = 2 * Math.PI * r;
    const full = pct >= 1;
    return (
        <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Svg width={40} height={40} style={{ position: "absolute" }}>
                <G rotation={-90} origin="20, 20">
                    <Circle cx={20} cy={20} r={r} stroke={th.line} strokeWidth={3} fill="none" />
                    <Circle
                        cx={20}
                        cy={20}
                        r={r}
                        stroke={full ? th.greenDeep : th.accent}
                        strokeWidth={3}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${circ} ${circ}`}
                        strokeDashoffset={circ * (1 - pct)}
                    />
                </G>
            </Svg>
            <Text
                style={{
                    fontSize: 12.5,
                    fontFamily: today ? th.sansBold : th.sans,
                    color: today ? th.accent : th.ink,
                }}
            >
                {label}
            </Text>
        </View>
    );
}

export default function CalendarScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const now = useMemo(() => new Date(), []);

    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const dim = daysInMonth(year, month);
    const startDay = new Date(year, month - 1, 1).getDay();
    const isCurrentMonth =
        year === now.getFullYear() && month === now.getMonth() + 1;
    const today = now.getDate();

    const { data: raw = [] } = useHabits(year, month);

    // completion fraction per day
    const perDay = useMemo(() => {
        const counts: Record<number, number> = {};
        for (const h of raw)
            for (const l of h.logs) counts[l.day] = (counts[l.day] ?? 0) + 1;
        return counts;
    }, [raw]);

    const [sel, setSel] = useState(today);

    const shiftMonth = (delta: number) => {
        let m = month + delta;
        let y = year;
        if (m < 1) {
            m = 12;
            y--;
        } else if (m > 12) {
            m = 1;
            y++;
        }
        setYear(y);
        setMonth(m);
        setSel(1);
    };

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);

    const completion = (d: number) => {
        if (isCurrentMonth && d > today) return null; // future
        if (raw.length === 0) return 0;
        return (perDay[d] ?? 0) / raw.length;
    };

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={160} />
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={{
                        paddingHorizontal: th.d.pad,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                    }}
                >
                    <View>
                        <Text style={{ fontSize: 12, color: th.ink2, fontFamily: th.sansBold, letterSpacing: 0.5 }}>
                            {monthNames[month - 1]!.toUpperCase()} {year}
                        </Text>
                        <Text style={{ fontFamily: th.display, fontSize: 34 * th.d.font, color: th.ink, marginTop: 4 }}>
                            Calendar
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                        <Pressable onPress={() => shiftMonth(-1)}>
                            <Icon name="chevronLeft" size={20} stroke={th.muted} />
                        </Pressable>
                        <Pressable onPress={() => shiftMonth(1)}>
                            <Icon name="chevronRight" size={20} stroke={th.ink} />
                        </Pressable>
                    </View>
                </View>

                {/* weekday header */}
                <View style={{ flexDirection: "row", paddingHorizontal: th.d.pad - 4, marginTop: 20, marginBottom: 8 }}>
                    {dayNames.map((d, i) => (
                        <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: th.muted, fontFamily: th.sansBold }}>
                            {d}
                        </Text>
                    ))}
                </View>

                {/* grid */}
                <View
                    style={{
                        paddingHorizontal: th.d.pad - 4,
                        flexDirection: "row",
                        flexWrap: "wrap",
                    }}
                >
                    {cells.map((d, i) => {
                        if (d === null)
                            return <View key={`b${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                        const c = completion(d);
                        const future = c === null;
                        const isToday = isCurrentMonth && d === today;
                        const isSel = d === sel;
                        return (
                            <Pressable
                                key={d}
                                disabled={future}
                                onPress={() => setSel(d)}
                                style={{
                                    width: `${100 / 7}%`,
                                    aspectRatio: 1,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {isSel && !future && (
                                    <View
                                        style={{
                                            position: "absolute",
                                            top: 2,
                                            left: 2,
                                            right: 2,
                                            bottom: 2,
                                            borderRadius: 12,
                                            backgroundColor: th.accentSoftBg,
                                        }}
                                    />
                                )}
                                {future ? (
                                    <Text style={{ fontSize: 12.5, color: th.muted }}>{d}</Text>
                                ) : (
                                    <Ring pct={c ?? 0} label={d} today={isToday} />
                                )}
                            </Pressable>
                        );
                    })}
                </View>

                {/* selected day detail */}
                <View style={{ paddingHorizontal: th.d.pad, paddingTop: 26 }}>
                    <Text style={{ fontSize: 11, color: th.muted, fontFamily: th.sansBold, letterSpacing: 0.6, marginBottom: 10 }}>
                        {isCurrentMonth && sel === today ? "TODAY" : `${monthNames[month - 1]!.toUpperCase()} ${sel}`}
                    </Text>
                    <Card pad={0} style={{ overflow: "hidden" }}>
                        {raw.length === 0 && (
                            <Text style={{ color: th.muted, padding: 16 }}>No habits yet.</Text>
                        )}
                        {raw.map((h, i) => {
                            const done = h.logs.some((l) => l.day === sel);
                            return (
                                <View
                                    key={h.id}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 14,
                                        paddingVertical: 13,
                                        paddingHorizontal: 16,
                                        borderTopWidth: i === 0 ? 0 : 1.5,
                                        borderTopColor: th.bg,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: done ? th.green : "transparent",
                                            borderWidth: done ? 0 : 2,
                                            borderColor: th.line,
                                        }}
                                    >
                                        {done && <Icon name="check" size={13} stroke="#fff" strokeWidth={2.6} />}
                                    </View>
                                    <Text style={{ flex: 1, fontSize: 14, color: done ? th.ink : th.muted, fontFamily: th.sans }}>
                                        {h.name}
                                    </Text>
                                    <Text style={{ fontSize: 11.5, color: th.muted }}>{h.verb ?? ""}</Text>
                                </View>
                            );
                        })}
                    </Card>
                </View>
            </ScrollView>
        </View>
    );
}
