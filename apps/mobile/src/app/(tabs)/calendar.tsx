import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";
import {
    useDayNotes,
    useHabits,
    useSetDayNote,
    useToggleLog,
} from "../../api/hooks";
import { isExpectedOnDate, normalizeDays } from "../../lib/schedule";
import { daysInMonth } from "../../lib/deriveStats";
import { dayIndex, dayIndexOf, dayNames, monthNames } from "../../lib/date";
import { SkyWash, Card } from "../../components/primitives";
import Icon from "../../components/Icon";

function Ring({
    pct,
    label,
    today,
}: {
    pct: number;
    label: number;
    today: boolean;
}) {
    const th = useTheme();
    const r = 16;
    const circ = 2 * Math.PI * r;
    const full = pct >= 1;
    return (
        <View
            style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Svg width={40} height={40} style={{ position: "absolute" }}>
                <G rotation={-90} origin="20, 20">
                    <Circle
                        cx={20}
                        cy={20}
                        r={r}
                        stroke={th.line}
                        strokeWidth={3}
                        fill="none"
                    />
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
    const todayIndex = useMemo(() => dayIndex(now), [now]);

    /**
     * Compared by day index rather than `d > today`, which only holds inside
     * the current month — paging forward would otherwise render next month's
     * days as ordinary past days and let them be checked off.
     */
    const isFuture = (d: number) => dayIndexOf(year, month, d) > todayIndex;

    const { data: raw = [] } = useHabits(year, month);
    const toggle = useToggleLog(year, month);
    const { data: notes = [] } = useDayNotes(year, month);
    const saveNote = useSetDayNote(year, month);

    // completion fraction per day
    const perDay = useMemo(() => {
        const counts: Record<number, number> = {};
        for (const h of raw)
            for (const l of h.logs) counts[l.day] = (counts[l.day] ?? 0) + 1;
        return counts;
    }, [raw]);

    /** How many habits were due on each day of this month. */
    const duePerDay = useMemo(() => {
        const due: Record<number, number> = {};
        for (let d = 1; d <= dim; d++) {
            const date = new Date(year, month - 1, d);
            let n = 0;
            for (const h of raw) {
                if (h.archivedAt && new Date(h.archivedAt) < date) continue;
                if (!isExpectedOnDate(normalizeDays(h.daysOfWeek), date))
                    continue;
                n++;
            }
            due[d] = n;
        }
        return due;
    }, [raw, year, month, dim]);

    const [sel, setSel] = useState(today);
    const selIsFuture = isFuture(sel);

    /** Habits that were actually due on the selected day. */
    const dueOnSel = useMemo(
        () =>
            raw.filter(
                (h) =>
                    !h.archivedAt &&
                    isExpectedOnDate(
                        normalizeDays(h.daysOfWeek),
                        new Date(year, month - 1, sel),
                    ),
            ),
        [raw, year, month, sel],
    );

    /** Days in this month that carry a note, for the grid's dot markers. */
    const noteDays = useMemo(
        () => new Set(notes.filter((n) => n.text.trim()).map((n) => n.day)),
        [notes],
    );

    const savedNote = notes.find((n) => n.day === sel)?.text ?? "";
    // Local draft so typing doesn't round-trip; re-seeded whenever the
    // selected day (or the note that arrives for it) changes.
    const [noteDraft, setNoteDraft] = useState(savedNote);
    useEffect(() => {
        setNoteDraft(savedNote);
    }, [savedNote, sel, year, month]);
    const noteDirty = noteDraft.trim() !== savedNote.trim();

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
        if (isFuture(d)) return null;
        // Scored against what was due that day, so a rest day with nothing
        // owed doesn't read as a failure.
        const due = duePerDay[d] ?? 0;
        if (due === 0) return 0;
        return Math.min(1, (perDay[d] ?? 0) / due);
    };

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={160} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 120,
                }}
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
                        <Text
                            style={{
                                fontSize: 12,
                                color: th.ink2,
                                fontFamily: th.sansBold,
                                letterSpacing: 0.5,
                            }}
                        >
                            {monthNames[month - 1]!.toUpperCase()} {year}
                        </Text>
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 34 * th.d.font,
                                color: th.ink,
                                marginTop: 4,
                            }}
                        >
                            Calendar
                        </Text>
                    </View>
                    <View
                        style={{
                            flexDirection: "row",
                            gap: 14,
                            alignItems: "center",
                        }}
                    >
                        <Pressable onPress={() => shiftMonth(-1)}>
                            <Icon
                                name="chevronLeft"
                                size={20}
                                stroke={th.muted}
                            />
                        </Pressable>
                        <Pressable onPress={() => shiftMonth(1)}>
                            <Icon
                                name="chevronRight"
                                size={20}
                                stroke={th.ink}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* weekday header */}
                <View
                    style={{
                        flexDirection: "row",
                        paddingHorizontal: th.d.pad - 4,
                        marginTop: 20,
                        marginBottom: 8,
                    }}
                >
                    {dayNames.map((d, i) => (
                        <Text
                            key={i}
                            style={{
                                flex: 1,
                                textAlign: "center",
                                fontSize: 10.5,
                                color: th.muted,
                                fontFamily: th.sansBold,
                            }}
                        >
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
                            return (
                                <View
                                    key={`b${i}`}
                                    style={{
                                        width: `${100 / 7}%`,
                                        aspectRatio: 1,
                                    }}
                                />
                            );
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
                                    <Text
                                        style={{
                                            fontSize: 12.5,
                                            color: th.muted,
                                        }}
                                    >
                                        {d}
                                    </Text>
                                ) : (
                                    <Ring
                                        pct={c ?? 0}
                                        label={d}
                                        today={isToday}
                                    />
                                )}
                                {/* A note is worth nothing if you can't find
                                    it again from the month view. */}
                                {noteDays.has(d) && (
                                    <View
                                        style={{
                                            position: "absolute",
                                            bottom: 4,
                                            width: 4,
                                            height: 4,
                                            borderRadius: 2,
                                            backgroundColor: th.sky,
                                        }}
                                    />
                                )}
                            </Pressable>
                        );
                    })}
                </View>

                {/* selected day detail */}
                <View style={{ paddingHorizontal: th.d.pad, paddingTop: 26 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.6,
                        }}
                    >
                        {isCurrentMonth && sel === today
                            ? "TODAY"
                            : `${monthNames[month - 1]!.toUpperCase()} ${sel}`}
                    </Text>
                    <Text
                        style={{
                            fontSize: 11.5,
                            color: th.muted,
                            fontFamily: th.sans,
                            marginTop: 3,
                            marginBottom: 10,
                        }}
                    >
                        {selIsFuture
                            ? "This day hasn't arrived yet."
                            : "Tap a habit to fill in a day you missed."}
                    </Text>
                    <Card pad={0} style={{ overflow: "hidden" }}>
                        {raw.length === 0 && (
                            <Text style={{ color: th.muted, padding: 16 }}>
                                No habits yet.
                            </Text>
                        )}
                        {raw.length > 0 && dueOnSel.length === 0 && (
                            <Text style={{ color: th.muted, padding: 16 }}>
                                Nothing was due on this day.
                            </Text>
                        )}
                        {dueOnSel.map((h, i) => {
                            const done = h.logs.some((l) => l.day === sel);
                            return (
                                <Pressable
                                    key={h.id}
                                    disabled={selIsFuture}
                                    onPress={() =>
                                        toggle.mutate({
                                            habitId: h.id,
                                            day: sel,
                                        })
                                    }
                                    style={({ pressed }) => ({
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 14,
                                        paddingVertical: 13,
                                        paddingHorizontal: 16,
                                        borderTopWidth: i === 0 ? 0 : 1.5,
                                        borderTopColor: th.bg,
                                        opacity: selIsFuture
                                            ? 0.45
                                            : pressed
                                              ? 0.6
                                              : 1,
                                    })}
                                >
                                    <View
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: done
                                                ? th.green
                                                : "transparent",
                                            borderWidth: done ? 0 : 2,
                                            borderColor: th.line,
                                        }}
                                    >
                                        {done && (
                                            <Icon
                                                name="check"
                                                size={13}
                                                stroke="#fff"
                                                strokeWidth={2.6}
                                            />
                                        )}
                                    </View>
                                    <Text
                                        style={{
                                            flex: 1,
                                            fontSize: 14,
                                            color: done ? th.ink : th.muted,
                                            fontFamily: th.sans,
                                        }}
                                    >
                                        {h.name}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 11.5,
                                            color: th.muted,
                                        }}
                                    >
                                        {h.verb ?? ""}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </Card>

                    {/* Day note. Deliberately day-scoped rather than attached
                        to a habit log: the note worth writing is usually about
                        a day you missed, and a missed day has no log to hang
                        it on. */}
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginTop: 22,
                            marginBottom: 8,
                        }}
                    >
                        NOTE
                    </Text>
                    <Card pad={14}>
                        <TextInput
                            value={noteDraft}
                            onChangeText={setNoteDraft}
                            placeholder={
                                selIsFuture
                                    ? "Plan a note for this day…"
                                    : "How did today go? What got in the way?"
                            }
                            placeholderTextColor={th.muted}
                            multiline
                            maxLength={2000}
                            style={{
                                fontFamily: th.sans,
                                fontSize: 14,
                                color: th.ink,
                                minHeight: 66,
                                textAlignVertical: "top",
                                padding: 0,
                            }}
                        />
                        {(noteDirty || savedNote.length > 0) && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "flex-end",
                                    alignItems: "center",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
                                {noteDirty && (
                                    <Pressable
                                        onPress={() => setNoteDraft(savedNote)}
                                        style={{
                                            paddingVertical: 8,
                                            paddingHorizontal: 12,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                fontFamily: th.sansBold,
                                                color: th.muted,
                                            }}
                                        >
                                            Discard
                                        </Text>
                                    </Pressable>
                                )}
                                <Pressable
                                    disabled={!noteDirty}
                                    onPress={() =>
                                        saveNote.mutate({
                                            day: sel,
                                            text: noteDraft,
                                        })
                                    }
                                    style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 16,
                                        borderRadius: 14,
                                        backgroundColor: noteDirty
                                            ? th.accent
                                            : th.surface2,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontFamily: th.sansBold,
                                            color: noteDirty
                                                ? "#fff"
                                                : th.muted,
                                        }}
                                    >
                                        {noteDraft.trim() ? "Save" : "Clear"}
                                    </Text>
                                </Pressable>
                            </View>
                        )}
                    </Card>
                </View>
            </ScrollView>
        </View>
    );
}
