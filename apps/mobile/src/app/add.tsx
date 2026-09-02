import { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useCreateHabit, useHabits, useUpdateHabit } from "../api/hooks";
import { Tod } from "../lib/types";
import { normalizeDays, scheduleLabel } from "../lib/schedule";
import {
    requestPermission,
    syncReminders,
    useReminderPrefs,
} from "../notifications";
import { setEnabled, setOverride } from "../notifications/store";
import {
    PRESET_TIMES,
    TOD_DEFAULT_TIME,
    effectiveReminder,
    formatTime12h,
    type HabitOverride,
    type TimeStr,
} from "../notifications/types";
import Plant from "../components/Plant";
import Icon from "../components/Icon";
import { Pill, Toggle } from "../components/primitives";

const ICONS = [
    "leaf",
    "sun",
    "droplet",
    "book",
    "dumbbell",
    "coffee",
    "music",
    "pen",
    "moon",
    "cloud",
    "flame",
    "sprout",
];

/** Weekday chip labels, index = weekday number (0 = Sunday). */
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const WHEN: { l: string; i: string; v: Tod }[] = [
    { l: "Morning", i: "sun", v: "morning" },
    { l: "Noon", i: "cloud", v: "afternoon" },
    { l: "Evening", i: "moonStars", v: "evening" },
    { l: "Anytime", i: "sparkle", v: "anytime" },
];

function Step({
    value,
    onLess,
    onMore,
    onCommit,
}: {
    value: string;
    onLess: () => void;
    onMore: () => void;
    onCommit: (digits: string) => void;
}) {
    const th = useTheme();
    const [draft, setDraft] = useState<string | null>(null);
    const step = (fn: () => void) => {
        setDraft(null);
        fn();
    };
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: th.surface2,
                borderRadius: 12,
            }}
        >
            <Pressable
                onPress={() => step(onLess)}
                style={{
                    width: 32,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Text style={{ fontSize: 18, color: th.ink }}>−</Text>
            </Pressable>
            <TextInput
                value={draft ?? value}
                onChangeText={(t) => {
                    const digits = t.replace(/\D/g, "");
                    setDraft(digits);
                    if (digits) onCommit(digits);
                }}
                onBlur={() => setDraft(null)}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                style={{
                    fontFamily: th.display,
                    fontSize: 17,
                    color: th.ink,
                    minWidth: 28,
                    textAlign: "center",
                    padding: 0,
                }}
            />
            <Pressable
                onPress={() => step(onMore)}
                style={{
                    width: 32,
                    height: 36,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Text style={{ fontSize: 18, color: th.ink }}>+</Text>
            </Pressable>
        </View>
    );
}

export default function AddScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEdit = !!id;

    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const create = useCreateHabit(year, month);
    const update = useUpdateHabit(year, month);
    const { data: habits = [] } = useHabits(year, month);
    const editing = id ? habits.find((h) => h.id === id) : undefined;
    const pending = isEdit ? update.isPending : create.isPending;

    const [name, setName] = useState("");
    const [verb, setVerb] = useState("");
    const [icon, setIcon] = useState("sprout");
    const [tod, setTod] = useState<Tod>("morning");
    const [goal, setGoal] = useState(20);
    // Weekday schedule, 0 = Sunday. Empty means daily, which is also what a
    // habit created before scheduling existed carries.
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);

    const [goalDraft, setGoalDraft] = useState<string | null>(null);
    const changeGoal = (t: string) => {
        const digits = t.replace(/\D/g, "");
        setGoalDraft(digits);
        const n = parseInt(digits, 10);
        if (!Number.isNaN(n)) setGoal(Math.min(31, Math.max(1, n)));
    };
    const stepGoal = (d: number) => {
        setGoalDraft(null);
        setGoal((g) => Math.min(31, Math.max(1, g + d)));
    };

    // Per-habit reminder, edited here and committed to the device-local
    // reminder store on save (the OS schedule is per-device, not synced).
    const reminders = useReminderPrefs();
    const [remindOn, setRemindOn] = useState(false);
    const [times, setTimes] = useState<TimeStr[]>([]);
    const [message, setMessage] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickH, setPickH] = useState(9); // 1–12
    const [pickM, setPickM] = useState(0);
    const [pickPm, setPickPm] = useState(false);

    // Pre-fill the form once the habit being edited is available from cache.
    const hydrated = useRef(false);
    useEffect(() => {
        if (isEdit && editing && !hydrated.current) {
            hydrated.current = true;
            setName(editing.name);
            setVerb(editing.verb ?? "");
            setIcon(editing.icon);
            setTod(editing.tod as Tod);
            setGoal(editing.goal);
            setDaysOfWeek(normalizeDays(editing.daysOfWeek));
            const eff = effectiveReminder(
                editing.id,
                editing.tod as Tod,
                reminders,
            );
            setRemindOn(reminders.enabled && eff.enabled);
            setTimes(eff.times);
            setMessage(reminders.overrides[editing.id]?.message ?? "");
        }
    }, [isEdit, editing, reminders]);

    const close = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    const toggleRemind = async () => {
        if (remindOn) {
            setRemindOn(false);
            return;
        }
        // The master switch is opt-in; flipping a habit on while it's off asks
        // for permission and enables it, so this toggle is never a dead switch.
        if (!reminders.enabled) {
            const ok = await requestPermission();
            if (!ok) {
                Alert.alert(
                    "Notifications are off",
                    "Turn on notifications for HabitFlow in your device settings to get habit reminders.",
                    [
                        { text: "Not now", style: "cancel" },
                        {
                            text: "Open settings",
                            onPress: () => Linking.openSettings(),
                        },
                    ],
                );
                return;
            }
            await setEnabled(true);
            void syncReminders();
        }
        if (times.length === 0) setTimes([TOD_DEFAULT_TIME[tod]]);
        setRemindOn(true);
    };

    const toggleTime = (t: TimeStr) => {
        const has = times.includes(t);
        const next = has ? times.filter((x) => x !== t) : [...times, t].sort();
        setTimes(next);
        // Zero times while on reads as "on but silent" — turn off instead,
        // matching the reminder store's own guard.
        if (next.length === 0) setRemindOn(false);
    };

    const addCustomTime = () => {
        const h24 = (pickH % 12) + (pickPm ? 12 : 0);
        const t = `${String(h24).padStart(2, "0")}:${String(pickM).padStart(2, "0")}`;
        if (!times.includes(t)) setTimes([...times, t].sort());
        setPickerOpen(false);
    };

    const save = () => {
        const input = {
            name: name.trim() || "New habit",
            goal,
            icon,
            tod,
            verb: verb.trim() || undefined,
            daysOfWeek: normalizeDays(daysOfWeek),
        };
        // Message is committed even while the reminder is off so it survives
        // an off/on round-trip; empty string overwrites (clears) an old one.
        const reminderPatch: HabitOverride = remindOn
            ? {
                  enabled: true,
                  times: times.length ? times : [TOD_DEFAULT_TIME[tod]],
                  message: message.trim(),
              }
            : { enabled: false, message: message.trim() };
        const finish = async (habitId: string) => {
            await setOverride(habitId, reminderPatch);
            void syncReminders();
            close();
        };
        if (isEdit && id) {
            update.mutate({ id, input }, { onSuccess: () => void finish(id) });
        } else {
            create.mutate(input, { onSuccess: (h) => void finish(h.id) });
        }
    };

    // Preset chips first, then any custom times the presets don't cover.
    const chips: { label: string; time: TimeStr }[] = [
        ...PRESET_TIMES,
        ...times
            .filter((t) => !PRESET_TIMES.some((p) => p.time === t))
            .map((t) => ({ label: formatTime12h(t), time: t })),
    ];
    const inQuiet = (t: TimeStr) => {
        const h = Number(t.split(":")[0]);
        return h >= 22 || h < 7;
    };
    const quietClash = remindOn && reminders.quietHours && times.some(inQuiet);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: th.bg }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* top bar */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: th.d.pad,
                        marginBottom: 12,
                    }}
                >
                    <Pressable onPress={close}>
                        <Icon name="x" size={24} stroke={th.ink} />
                    </Pressable>
                    <Text
                        style={{
                            fontSize: 13,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.6,
                        }}
                    >
                        {isEdit ? "EDIT HABIT" : "NEW HABIT"}
                    </Text>
                    <Pressable onPress={save} disabled={pending}>
                        <Text
                            style={{
                                fontSize: 14,
                                fontFamily: th.sansBold,
                                color: th.accent,
                            }}
                        >
                            {pending ? "…" : "Save"}
                        </Text>
                    </Pressable>
                </View>

                {/* preview */}
                <View style={{ alignItems: "center", marginBottom: 4 }}>
                    <Plant streak={1} doneToday size={116} />
                </View>

                {/* name */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 18 }}>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Habit Name"
                        placeholderTextColor={th.muted}
                        style={{
                            fontFamily: th.display,
                            fontSize: 30,
                            color: th.ink,
                            // Android places the caret on the right when an
                            // empty TextInput is center-aligned; only center
                            // once there's text so typing always starts left.
                            textAlign: name ? "center" : "left",
                            paddingVertical: 4,
                        }}
                    />
                    <View
                        style={{
                            height: 2,
                            backgroundColor: th.line,
                            marginTop: 2,
                        }}
                    />
                    <TextInput
                        value={verb}
                        onChangeText={setVerb}
                        placeholder="short note · e.g. 20 min"
                        placeholderTextColor={th.muted}
                        style={{
                            fontFamily: th.sans,
                            fontSize: 13,
                            color: th.ink2,
                            textAlign: verb ? "center" : "left",
                            marginTop: 10,
                        }}
                    />
                    <View
                        style={{
                            height: 1,
                            backgroundColor: th.line,
                            marginTop: 2,
                        }}
                    />
                </View>

                {/* seed icons */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 22 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginBottom: 8,
                        }}
                    >
                        SEED
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 6,
                        }}
                    >
                        {ICONS.map((ic) => {
                            const on = icon === ic;
                            return (
                                <Pressable
                                    key={ic}
                                    onPress={() => setIcon(ic)}
                                    style={{
                                        width: "15%",
                                        aspectRatio: 1,
                                        borderRadius: 14,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginBottom: 6,
                                        backgroundColor: on
                                            ? th.accent
                                            : th.surface,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.accent : th.line,
                                    }}
                                >
                                    <Icon
                                        name={ic}
                                        size={18}
                                        stroke={on ? "#fff" : th.ink2}
                                        strokeWidth={1.8}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* when */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 22 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginBottom: 8,
                        }}
                    >
                        WHEN
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {WHEN.map((o) => {
                            const on = tod === o.v;
                            return (
                                <Pressable
                                    key={o.v}
                                    onPress={() => setTod(o.v)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 14,
                                        borderRadius: 16,
                                        alignItems: "center",
                                        gap: 6,
                                        backgroundColor: on
                                            ? th.ink
                                            : th.surface,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.ink : th.line,
                                    }}
                                >
                                    <Icon
                                        name={o.i}
                                        size={18}
                                        stroke={on ? th.bg : th.ink2}
                                        strokeWidth={1.8}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontFamily: th.sansBold,
                                            color: on ? th.bg : th.ink,
                                        }}
                                    >
                                        {o.l}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* repeat schedule */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 22 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                color: th.muted,
                                fontFamily: th.sansBold,
                                letterSpacing: 0.8,
                            }}
                        >
                            REPEATS
                        </Text>
                        <Text
                            style={{
                                fontSize: 12,
                                color: th.ink2,
                                fontFamily: th.sansBold,
                            }}
                        >
                            {scheduleLabel(daysOfWeek)}
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                        {DOW.map((label, dow) => {
                            // No days selected means daily, so every chip reads
                            // as on — that is what the habit actually does.
                            const on =
                                daysOfWeek.length === 0 ||
                                daysOfWeek.includes(dow);
                            return (
                                <Pressable
                                    key={dow}
                                    onPress={() =>
                                        setDaysOfWeek((prev) => {
                                            // The first tap out of "daily"
                                            // starts from every day, so
                                            // switching one day off leaves the
                                            // other six on rather than wiping
                                            // the whole week.
                                            const base = prev.length
                                                ? prev
                                                : [0, 1, 2, 3, 4, 5, 6];
                                            const next = base.includes(dow)
                                                ? base.filter((d) => d !== dow)
                                                : [...base, dow];
                                            // Every day off isn't a habit —
                                            // normalizeDays folds it to daily.
                                            return normalizeDays(next);
                                        })
                                    }
                                    style={{
                                        flex: 1,
                                        paddingVertical: 11,
                                        borderRadius: 13,
                                        alignItems: "center",
                                        backgroundColor: on
                                            ? th.accentSoftBg
                                            : th.surface,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.accent : th.line,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontFamily: th.sansBold,
                                            color: on ? th.deep : th.muted,
                                        }}
                                    >
                                        {label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* monthly goal */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 28 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginBottom: 8,
                        }}
                    >
                        MONTHLY GOAL
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: th.line,
                            borderRadius: 16,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                        }}
                    >
                        <Pressable
                            onPress={() => stepGoal(-1)}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: th.surface2,
                            }}
                        >
                            <Text style={{ fontSize: 22, color: th.ink }}>
                                −
                            </Text>
                        </Pressable>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                            }}
                        >
                            <TextInput
                                value={goalDraft ?? String(goal)}
                                onChangeText={changeGoal}
                                onBlur={() => setGoalDraft(null)}
                                keyboardType="number-pad"
                                maxLength={2}
                                selectTextOnFocus
                                style={{
                                    fontFamily: th.display,
                                    fontSize: 24,
                                    color: th.ink,
                                    minWidth: 36,
                                    textAlign: "center",
                                    padding: 0,
                                }}
                            />
                            <Text
                                style={{
                                    fontFamily: th.display,
                                    fontSize: 14,
                                    color: th.muted,
                                    marginLeft: 4,
                                }}
                            >
                                days
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => stepGoal(1)}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: th.surface2,
                            }}
                        >
                            <Text style={{ fontSize: 22, color: th.ink }}>
                                +
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* reminder */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 28 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginBottom: 8,
                        }}
                    >
                        REMINDER
                    </Text>
                    <View
                        style={{
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: th.line,
                            borderRadius: 16,
                            padding: 16,
                            gap: 14,
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <Icon
                                name="bell"
                                size={18}
                                stroke={th.ink2}
                                strokeWidth={1.7}
                            />
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        fontSize: 14.5,
                                        color: th.ink,
                                        fontFamily: th.sans,
                                    }}
                                >
                                    Remind me
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: th.muted,
                                        marginTop: 2,
                                    }}
                                >
                                    {remindOn
                                        ? times.map(formatTime12h).join(" · ")
                                        : "No reminder for this habit"}
                                </Text>
                            </View>
                            <Toggle
                                on={remindOn}
                                onPress={() => void toggleRemind()}
                            />
                        </View>

                        {remindOn && (
                            <>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        flexWrap: "wrap",
                                        gap: 6,
                                    }}
                                >
                                    {chips.map((c) => {
                                        const on = times.includes(c.time);
                                        return (
                                            <Pressable
                                                key={c.time}
                                                onPress={() =>
                                                    toggleTime(c.time)
                                                }
                                                style={{
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 12,
                                                    borderRadius: 14,
                                                    backgroundColor: on
                                                        ? th.accent
                                                        : th.surface2,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 12,
                                                        fontFamily: th.sansBold,
                                                        color: on
                                                            ? "#fff"
                                                            : th.ink2,
                                                    }}
                                                >
                                                    {c.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                    <Pressable
                                        onPress={() => setPickerOpen((o) => !o)}
                                        style={{
                                            paddingVertical: 6,
                                            paddingHorizontal: 12,
                                            borderRadius: 14,
                                            borderWidth: 1.5,
                                            borderColor: th.line,
                                            backgroundColor: pickerOpen
                                                ? th.surface2
                                                : "transparent",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontFamily: th.sansBold,
                                                color: th.ink2,
                                            }}
                                        >
                                            + Custom
                                        </Text>
                                    </Pressable>
                                </View>

                                {pickerOpen && (
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                            gap: 8,
                                        }}
                                    >
                                        <Step
                                            value={`${pickH}`}
                                            onLess={() =>
                                                setPickH(
                                                    (h) => ((h + 10) % 12) + 1,
                                                )
                                            }
                                            onMore={() =>
                                                setPickH((h) => (h % 12) + 1)
                                            }
                                            onCommit={(t) => {
                                                const n = parseInt(t, 10);
                                                if (Number.isNaN(n)) return;
                                                // 0 reads as 12 o'clock.
                                                setPickH(
                                                    n === 0
                                                        ? 12
                                                        : Math.min(12, n),
                                                );
                                            }}
                                        />
                                        <Step
                                            value={String(pickM).padStart(
                                                2,
                                                "0",
                                            )}
                                            onLess={() =>
                                                setPickM((m) => (m + 55) % 60)
                                            }
                                            onMore={() =>
                                                setPickM((m) => (m + 5) % 60)
                                            }
                                            onCommit={(t) => {
                                                const n = parseInt(t, 10);
                                                if (!Number.isNaN(n))
                                                    setPickM(Math.min(59, n));
                                            }}
                                        />
                                        <Pressable
                                            onPress={() => setPickPm((p) => !p)}
                                            style={{
                                                paddingVertical: 8,
                                                paddingHorizontal: 12,
                                                borderRadius: 12,
                                                backgroundColor: th.surface2,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 13,
                                                    fontFamily: th.sansBold,
                                                    color: th.ink,
                                                }}
                                            >
                                                {pickPm ? "PM" : "AM"}
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={addCustomTime}
                                            style={{
                                                paddingVertical: 8,
                                                paddingHorizontal: 14,
                                                borderRadius: 12,
                                                backgroundColor: th.accent,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 13,
                                                    fontFamily: th.sansBold,
                                                    color: "#fff",
                                                }}
                                            >
                                                Add time
                                            </Text>
                                        </Pressable>
                                    </View>
                                )}

                                {quietClash && (
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: th.muted,
                                        }}
                                    >
                                        Times between 10:00 PM and 7:00 AM are
                                        silenced by Quiet hours (see Settings).
                                    </Text>
                                )}

                                <View>
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            color: th.muted,
                                            fontFamily: th.sansBold,
                                            letterSpacing: 0.8,
                                            marginBottom: 6,
                                        }}
                                    >
                                        NOTIFICATION MESSAGE
                                    </Text>
                                    <TextInput
                                        value={message}
                                        onChangeText={setMessage}
                                        placeholder="e.g. Did you go to the office today?"
                                        placeholderTextColor={th.muted}
                                        maxLength={120}
                                        style={{
                                            backgroundColor: th.surface2,
                                            borderRadius: 12,
                                            paddingVertical: 10,
                                            paddingHorizontal: 12,
                                            fontFamily: th.sans,
                                            fontSize: 14,
                                            color: th.ink,
                                        }}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: th.muted,
                                            marginTop: 6,
                                        }}
                                    >
                                        Shown as the notification text when this
                                        habit is reminded on its own.
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>

                <View style={{ paddingHorizontal: th.d.pad }}>
                    <Pill
                        primary
                        icon="sprout"
                        label={
                            isEdit
                                ? pending
                                    ? "Saving…"
                                    : "Save changes"
                                : pending
                                  ? "Planting…"
                                  : "Plant this habit"
                        }
                        onPress={save}
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
