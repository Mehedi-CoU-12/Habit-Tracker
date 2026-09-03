import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AppState,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import Svg, {
    Circle,
    Defs,
    Line,
    Path,
    RadialGradient,
    Rect,
    Stop,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { useTheme } from "../theme/ThemeProvider";
import { hexA } from "../theme/tokens";
import {
    habitsKey,
    useFocusStats,
    useHabits,
    useRecordFocusSession,
    useToggleLog,
} from "../api/hooks";
import { queryClient } from "../api/queryClient";
import { hasPermission } from "../notifications/permissions";
import { deriveHabitStats, daysInMonth } from "../lib/deriveStats";
import { isDayComplete } from "../lib/completion";
import { dateKey } from "../lib/date";
import { KEYS, storage } from "../lib/storage";
import { ApiHabit, HabitWithStats } from "../lib/types";
import { playSound, useSoundPrefs } from "../sound";
import { Pill, Sparkles } from "../components/primitives";
import Plant from "../components/Plant";
import Icon from "../components/Icon";

type Mode = "focus" | "short" | "long";

type FocusPersist = {
    focusMin: number;
    mode: Mode;
    remaining: number;
    running: boolean;
    endsAt: number | null;
    sessions: number;
    /** dateKey of `sessions` — a new day starts the count over. */
    day: string;
    habitId: string | null;
};

const PRESETS = [15, 25, 50];
const breakLen = (m: Mode) => (m === "long" ? 15 : 5);
const FOCUS_NOTIF_ID = "habitflow.focus.end";
const KEEP_AWAKE_TAG = "focus-timer";

const fmt = (s: number) => {
    const m = Math.floor(Math.max(0, s) / 60);
    const ss = Math.max(0, s) % 60;
    return `${m}:${String(ss).padStart(2, "0")}`;
};

const fmtMin = (m: number) =>
    m >= 60
        ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim()
        : `${m}m`;

const todayKey = (d = new Date()) =>
    dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());

async function scheduleEndNotification(
    endsAt: number,
    mode: Mode,
    habitName: string,
): Promise<void> {
    if (Platform.OS === "web" || endsAt <= Date.now()) return;
    try {
        if (!(await hasPermission())) return;
        await Notifications.scheduleNotificationAsync({
            identifier: FOCUS_NOTIF_ID,
            content:
                mode === "focus"
                    ? {
                          title: "Session complete 🌱",
                          body: `${habitName} got its sunlight. Time for a break.`,
                          sound: "default",
                      }
                    : {
                          title: "Break's over",
                          body: "Ready to grow again? Start your next session.",
                          sound: "default",
                      },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(endsAt),
            },
        });
    } catch {
        // Notifications are best-effort; the timestamp math still recovers.
    }
}

function cancelEndNotification(): void {
    if (Platform.OS === "web") return;
    void Notifications.cancelScheduledNotificationAsync(FOCUS_NOTIF_ID).catch(
        () => {},
    );
    void Notifications.dismissNotificationAsync(FOCUS_NOTIF_ID).catch(() => {});
}

/** Is this habit already logged for today? (read straight from the cache) */
function isDoneToday(habitId: string, now: Date): boolean {
    const list = queryClient.getQueryData<ApiHabit[]>(
        habitsKey(now.getFullYear(), now.getMonth() + 1),
    );
    const habit = list?.find((h) => h.id === habitId);
    return !!habit && isDayComplete(habit, now.getDate());
}

export default function FocusScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ habit?: string }>();
    const soundPrefs = useSoundPrefs();

    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dim = daysInMonth(year, month);

    const { data: raw = [] } = useHabits(year, month);
    const toggle = useToggleLog(year, month);
    const { data: stats } = useFocusStats();
    const recordFocus = useRecordFocusSession();
    const habits: HabitWithStats[] = useMemo(
        () => raw.map((h) => deriveHabitStats(h, year, month, dim, now)),
        [raw, year, month, dim, now],
    );

    const [hydrated, setHydrated] = useState(false);
    const [focusMin, setFocusMin] = useState(25);
    const [mode, setMode] = useState<Mode>("focus");
    const [sessions, setSessions] = useState(0);
    const [remaining, setRemaining] = useState(25 * 60);
    const [running, setRunning] = useState(false);
    const [habitId, setHabitId] = useState<string | null>(null);
    const [justDone, setJustDone] = useState(false);

    const endsAtRef = useRef<number | null>(null);
    const justDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const habit = habits.find((h) => h.id === habitId) ?? habits[0];

    // Latest values for interval/AppState/unmount closures.
    const ref = useRef({
        focusMin,
        mode,
        sessions,
        remaining,
        running,
        habitId,
        habitName: habit?.name ?? "Your habit",
    });
    ref.current = {
        focusMin,
        mode,
        sessions,
        remaining,
        running,
        habitId,
        habitName: habit?.name ?? "Your habit",
    };

    const durOf = useCallback(
        (m: Mode, fm = ref.current.focusMin) =>
            (m === "focus" ? fm : breakLen(m)) * 60,
        [],
    );

    /** Persist current state merged with the transition being applied. */
    const persistNow = useCallback((over: Partial<FocusPersist>) => {
        const c = ref.current;
        const data: FocusPersist = {
            focusMin: c.focusMin,
            mode: c.mode,
            remaining: c.remaining,
            running: c.running,
            endsAt: endsAtRef.current,
            sessions: c.sessions,
            day: todayKey(),
            habitId: c.habitId,
            ...over,
        };
        void storage.set(KEYS.focus, JSON.stringify(data));
    }, []);

    /** Water the habit (mark done today) — never un-completes. */
    const waterHabit = useCallback(
        (id: string) => {
            const d = new Date();
            if (!isDoneToday(id, d)) {
                toggle.mutate({ habitId: id, day: d.getDate() });
            }
        },
        [toggle],
    );

    // ── Hydrate persisted state (async, unlike the web's localStorage) ──────
    useEffect(() => {
        let active = true;
        void storage.get(KEYS.focus).then((rawState) => {
            if (!active) return;
            let p: Partial<FocusPersist> = {};
            if (rawState) {
                try {
                    p = JSON.parse(rawState) as Partial<FocusPersist>;
                } catch {
                    /* corrupt state → defaults */
                }
            }
            const today = todayKey();
            const fm =
                typeof p.focusMin === "number" && PRESETS.includes(p.focusMin)
                    ? p.focusMin
                    : 25;
            let nextMode: Mode =
                p.mode === "short" || p.mode === "long" ? p.mode : "focus";
            let nextSessions =
                p.day === today && typeof p.sessions === "number"
                    ? p.sessions
                    : 0;
            const paramHabit = Array.isArray(params.habit)
                ? params.habit[0]
                : params.habit;
            const nextHabitId =
                paramHabit ??
                (typeof p.habitId === "string" ? p.habitId : null);

            let nextRemaining: number;
            let nextRunning = false;

            if (p.running && typeof p.endsAt === "number") {
                const left = Math.round((p.endsAt - Date.now()) / 1000);
                if (left > 0) {
                    // still running — resume seamlessly
                    endsAtRef.current = p.endsAt;
                    nextRunning = true;
                    nextRemaining = left;
                } else if (todayKey(new Date(p.endsAt)) === today) {
                    // elapsed while we were away → land on the next phase
                    if (nextMode === "focus") {
                        nextSessions += 1;
                        if (nextHabitId) waterHabit(nextHabitId);
                        recordFocus.mutate({
                            habitId: nextHabitId,
                            minutes: fm,
                        });
                        nextMode = nextSessions % 4 === 0 ? "long" : "short";
                        nextRemaining = breakLen(nextMode) * 60;
                    } else {
                        nextMode = "focus";
                        nextRemaining = fm * 60;
                    }
                } else {
                    // ended on another day — stale, start fresh
                    nextMode = "focus";
                    nextRemaining = fm * 60;
                }
            } else {
                const max =
                    (nextMode === "focus" ? fm : breakLen(nextMode)) * 60;
                nextRemaining =
                    typeof p.remaining === "number" &&
                    p.remaining > 0 &&
                    p.remaining <= max
                        ? p.remaining
                        : max;
            }

            setFocusMin(fm);
            setMode(nextMode);
            setSessions(nextSessions);
            setHabitId(nextHabitId);
            setRemaining(nextRemaining);
            setRunning(nextRunning);
            setHydrated(true);
            // We're watching again — clear any pending/shown end notification.
            cancelEndNotification();
            void storage.set(
                KEYS.focus,
                JSON.stringify({
                    focusMin: fm,
                    mode: nextMode,
                    remaining: nextRemaining,
                    running: nextRunning,
                    endsAt: endsAtRef.current,
                    sessions: nextSessions,
                    day: today,
                    habitId: nextHabitId,
                } satisfies FocusPersist),
            );
        });
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Phase completion ─────────────────────────────────────────────────────
    const complete = useCallback(() => {
        const c = ref.current;
        if (c.mode === "focus") {
            const next = c.sessions + 1;
            setSessions(next);
            setJustDone(true);
            if (justDoneTimer.current) clearTimeout(justDoneTimer.current);
            justDoneTimer.current = setTimeout(() => setJustDone(false), 2200);
            if (c.habitId ?? habit?.id) waterHabit(c.habitId ?? habit!.id);
            recordFocus.mutate({
                habitId: c.habitId ?? habit?.id ?? null,
                minutes: c.focusMin,
            });
            playSound("end");
            const nm: Mode = next % 4 === 0 ? "long" : "short";
            setMode(nm);
            setRemaining(breakLen(nm) * 60);
            persistNow({
                mode: nm,
                remaining: breakLen(nm) * 60,
                running: false,
                endsAt: null,
                sessions: next,
            });
        } else {
            setMode("focus");
            setRemaining(c.focusMin * 60);
            persistNow({
                mode: "focus",
                remaining: c.focusMin * 60,
                running: false,
                endsAt: null,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [persistNow, waterHabit]);

    // ── Ticking (timestamp-based; drift-free and background-tolerant) ───────
    useEffect(() => {
        if (!running || !hydrated) return;
        if (!endsAtRef.current) {
            endsAtRef.current = Date.now() + ref.current.remaining * 1000;
        }
        const id = setInterval(() => {
            const left = Math.round(
                ((endsAtRef.current ?? 0) - Date.now()) / 1000,
            );
            if (left <= 0) {
                setRemaining(0);
                setRunning(false);
                endsAtRef.current = null;
                complete();
            } else {
                setRemaining(left);
            }
        }, 250);
        return () => clearInterval(id);
    }, [running, hydrated, complete]);

    // Keep the screen on while a session runs.
    useEffect(() => {
        if (!running) return;
        void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
        return () => {
            void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
        };
    }, [running]);

    // Backgrounding with a live countdown → hand off to a local notification;
    // coming back → we're watching again, take it back.
    useEffect(() => {
        const sub = AppState.addEventListener("change", (s) => {
            const c = ref.current;
            if (s === "active") {
                cancelEndNotification();
            } else if (c.running && endsAtRef.current) {
                void scheduleEndNotification(
                    endsAtRef.current,
                    c.mode,
                    c.habitName,
                );
            }
        });
        return () => sub.remove();
    }, []);

    // Leaving the screen with the timer running → same hand-off.
    useEffect(
        () => () => {
            const c = ref.current;
            if (c.running && endsAtRef.current) {
                void scheduleEndNotification(
                    endsAtRef.current,
                    c.mode,
                    c.habitName,
                );
            }
            if (justDoneTimer.current) clearTimeout(justDoneTimer.current);
        },
        [],
    );

    // ── Controls ─────────────────────────────────────────────────────────────
    const onToggle = () => {
        if (!hydrated) return;
        if (running) {
            const left = Math.max(
                0,
                Math.round(((endsAtRef.current ?? 0) - Date.now()) / 1000),
            );
            setRunning(false);
            setRemaining(left);
            endsAtRef.current = null;
            cancelEndNotification();
            persistNow({ running: false, remaining: left, endsAt: null });
        } else {
            const ends = Date.now() + remaining * 1000;
            endsAtRef.current = ends;
            setRunning(true);
            playSound("start");
            persistNow({ running: true, endsAt: ends });
        }
    };

    const onReset = () => {
        const d = durOf(mode);
        setRunning(false);
        endsAtRef.current = null;
        cancelEndNotification();
        setRemaining(d);
        persistNow({ running: false, endsAt: null, remaining: d });
    };

    const onSkip = () => {
        setRunning(false);
        endsAtRef.current = null;
        cancelEndNotification();
        const nm: Mode =
            mode === "focus"
                ? sessions % 4 === 3
                    ? "long"
                    : "short"
                : "focus";
        const d = durOf(nm);
        setMode(nm);
        setRemaining(d);
        persistNow({ running: false, endsAt: null, mode: nm, remaining: d });
    };

    const onPreset = (p: number) => {
        setFocusMin(p);
        if (mode === "focus") {
            setRunning(false);
            endsAtRef.current = null;
            cancelEndNotification();
            setRemaining(p * 60);
            persistNow({
                focusMin: p,
                running: false,
                endsAt: null,
                remaining: p * 60,
            });
        } else {
            persistNow({ focusMin: p });
        }
    };

    const onPickHabit = (id: string) => {
        setHabitId(id);
        persistNow({ habitId: id });
    };

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    // ── Empty garden guard ───────────────────────────────────────────────────
    if (!habit) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: th.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 14,
                    padding: 32,
                }}
            >
                <Plant streak={0} doneToday size={110} />
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 22,
                        color: th.ink,
                    }}
                >
                    Nothing to grow yet
                </Text>
                <Text
                    style={{
                        color: th.muted,
                        textAlign: "center",
                        fontFamily: th.sans,
                        fontSize: 13.5,
                    }}
                >
                    Plant a habit first — then give it sunlight with a focus
                    session.
                </Text>
                <Pill label="Back to garden" onPress={goBack} />
            </View>
        );
    }

    // ── Ring geometry & visuals ──────────────────────────────────────────────
    const R = 130;
    const C = 2 * Math.PI * R;
    const total = durOf(mode);
    const progress = total > 0 ? Math.min(1, 1 - remaining / total) : 0;
    const isFocus = mode === "focus";
    const ringColor = isFocus ? th.accent : th.green;
    const chipColor = isFocus ? th.deep : th.greenDeep;
    const glow = isFocus ? progress : 0;
    const modeLabel = isFocus
        ? "Focus"
        : mode === "long"
          ? "Long break"
          : "Short break";
    const filledDots =
        sessions % 4 === 0 ? (sessions > 0 ? 4 : 0) : sessions % 4;

    const roundBtn = {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: th.surface,
        borderWidth: 1.5,
        borderColor: th.line,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    };

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <LinearGradient
                colors={[hexA(ringColor, th.dark ? 0.16 : 0.22), th.bg]}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 320,
                }}
                pointerEvents="none"
            />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 28 + insets.bottom,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* top bar */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: th.d.pad,
                    }}
                >
                    <Pressable onPress={goBack} style={roundBtn}>
                        <Icon name="chevronLeft" size={18} stroke={th.ink} />
                    </Pressable>
                    <Text
                        style={{
                            fontSize: 13,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 1.5,
                        }}
                    >
                        FOCUS
                    </Text>
                    <Pressable
                        onPress={() => router.push("/sound")}
                        style={roundBtn}
                    >
                        <Icon
                            name={soundPrefs.on ? "volume" : "volumeOff"}
                            size={17}
                            stroke={th.ink}
                            strokeWidth={1.8}
                        />
                    </Pressable>
                </View>

                {/* mode chip + habit */}
                <View style={{ alignItems: "center", marginTop: 8 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            paddingVertical: 6,
                            paddingHorizontal: 14,
                            borderRadius: 20,
                            backgroundColor: hexA(
                                ringColor,
                                th.dark ? 0.2 : 0.16,
                            ),
                        }}
                    >
                        <Icon
                            name={isFocus ? "sun" : "coffee"}
                            size={15}
                            stroke={chipColor}
                            strokeWidth={1.8}
                        />
                        <Text
                            style={{
                                fontSize: 13,
                                fontFamily: th.sansBold,
                                color: chipColor,
                            }}
                        >
                            {modeLabel}
                        </Text>
                    </View>
                    <Text
                        style={{
                            fontSize: 13.5,
                            color: th.ink2,
                            marginTop: 10,
                            fontFamily: th.sans,
                        }}
                    >
                        {isFocus ? "Growing" : "Resting"}{" "}
                        <Text
                            style={{ fontFamily: th.sansBold, color: th.ink }}
                        >
                            {habit.name}
                        </Text>
                    </Text>
                </View>

                {/* timer ring with plant */}
                <View style={{ alignItems: "center", marginVertical: 10 }}>
                    <View style={{ width: 300, height: 300 }}>
                        {/* sun glow that intensifies with progress */}
                        <Svg
                            width={300}
                            height={300}
                            style={{ position: "absolute" }}
                        >
                            <Defs>
                                <RadialGradient
                                    id="sunglow"
                                    cx="50%"
                                    cy="50%"
                                    r="50%"
                                >
                                    <Stop
                                        offset="0%"
                                        stopColor={th.sun}
                                        stopOpacity={0.5}
                                    />
                                    <Stop
                                        offset="70%"
                                        stopColor={th.sun}
                                        stopOpacity={0}
                                    />
                                </RadialGradient>
                            </Defs>
                            <Circle
                                cx={150}
                                cy={150}
                                r={100 * (0.7 + glow * 0.5)}
                                fill="url(#sunglow)"
                                opacity={0.3 + glow * 0.7}
                            />
                        </Svg>
                        <Svg
                            width={300}
                            height={300}
                            style={{
                                position: "absolute",
                                transform: [{ rotate: "-90deg" }],
                            }}
                        >
                            <Circle
                                cx={150}
                                cy={150}
                                r={R}
                                fill="none"
                                stroke={th.line}
                                strokeWidth={10}
                            />
                            <Circle
                                cx={150}
                                cy={150}
                                r={R}
                                fill="none"
                                stroke={ringColor}
                                strokeWidth={10}
                                strokeLinecap="round"
                                strokeDasharray={`${C}`}
                                strokeDashoffset={C * (1 - progress)}
                            />
                        </Svg>
                        {/* center: plant + time */}
                        <View
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <View>
                                <Plant
                                    streak={habit.streak}
                                    doneToday
                                    size={96}
                                />
                                <Sparkles show={justDone} />
                            </View>
                            <Text
                                style={{
                                    fontFamily: th.display,
                                    fontSize: 52,
                                    color: th.ink,
                                    marginTop: -8,
                                    fontVariant: ["tabular-nums"],
                                }}
                            >
                                {fmt(remaining)}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 11.5,
                                    color: justDone ? th.greenDeep : th.muted,
                                    fontFamily: th.sansBold,
                                    marginTop: 4,
                                }}
                            >
                                {justDone
                                    ? "🌱 Session complete!"
                                    : running
                                      ? "in progress"
                                      : "paused"}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* session dots */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                    }}
                >
                    {[0, 1, 2, 3].map((i) => (
                        <View
                            key={i}
                            style={{
                                width: 9,
                                height: 9,
                                borderRadius: 5,
                                backgroundColor:
                                    filledDots > i ? th.accent : th.line,
                            }}
                        />
                    ))}
                    <Text
                        style={{
                            fontSize: 12,
                            color: th.muted,
                            marginLeft: 8,
                            fontFamily: th.sansBold,
                        }}
                    >
                        {sessions} today
                    </Text>
                </View>

                {/* presets (idle, focus mode only) */}
                {!running && isFocus && (
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 8,
                            marginTop: 14,
                        }}
                    >
                        {PRESETS.map((p) => {
                            const on = focusMin === p;
                            return (
                                <Pressable
                                    key={p}
                                    onPress={() => onPreset(p)}
                                    style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 16,
                                        borderRadius: 20,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.accent : th.line,
                                        backgroundColor: on
                                            ? hexA(th.accent, 0.12)
                                            : th.surface,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontFamily: th.sansBold,
                                            color: on ? th.deep : th.ink2,
                                        }}
                                    >
                                        {p} min
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {/* controls */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 16,
                        paddingVertical: 18,
                    }}
                >
                    <Pressable
                        onPress={onReset}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: th.line,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icon name="chevronLeft" size={20} stroke={th.ink2} />
                    </Pressable>
                    <Pressable
                        onPress={onToggle}
                        style={{
                            width: 84,
                            height: 84,
                            borderRadius: 42,
                            backgroundColor: running ? th.surface : ringColor,
                            borderWidth: running ? 2 : 0,
                            borderColor: ringColor,
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: ringColor,
                            shadowOpacity: running ? 0 : 0.45,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 8 },
                            elevation: running ? 0 : 8,
                        }}
                    >
                        {running ? (
                            <Svg width={26} height={26} viewBox="0 0 24 24">
                                <Rect
                                    x={6}
                                    y={5}
                                    width={4}
                                    height={14}
                                    rx={1.5}
                                    fill={ringColor}
                                />
                                <Rect
                                    x={14}
                                    y={5}
                                    width={4}
                                    height={14}
                                    rx={1.5}
                                    fill={ringColor}
                                />
                            </Svg>
                        ) : (
                            <Svg
                                width={30}
                                height={30}
                                viewBox="0 0 24 24"
                                style={{ marginLeft: 4 }}
                            >
                                <Path d="M7 5 v14 l12 -7 z" fill="#fff" />
                            </Svg>
                        )}
                    </Pressable>
                    <Pressable
                        onPress={onSkip}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: th.line,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Svg width={20} height={20} viewBox="0 0 24 24">
                            <Path
                                d="M5 5 l9 7 l-9 7 z"
                                fill="none"
                                stroke={th.ink2}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <Line
                                x1={18}
                                y1={5}
                                x2={18}
                                y2={19}
                                stroke={th.ink2}
                                strokeWidth={2}
                                strokeLinecap="round"
                            />
                        </Svg>
                    </Pressable>
                </View>

                {/* switch habit */}
                <View style={{ paddingHorizontal: th.d.pad, paddingTop: 4 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 1.2,
                            textAlign: "center",
                            marginBottom: 10,
                        }}
                    >
                        FOCUS ON
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        {habits.map((h) => {
                            const on = h.id === habit.id;
                            return (
                                <Pressable
                                    key={h.id}
                                    onPress={() => onPickHabit(h.id)}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 7,
                                        paddingVertical: 8,
                                        paddingHorizontal: 14,
                                        borderRadius: 20,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.accent : th.line,
                                        backgroundColor: on
                                            ? hexA(th.accent, 0.12)
                                            : th.surface,
                                    }}
                                >
                                    <Icon
                                        name={h.icon || "sprout"}
                                        size={15}
                                        stroke={on ? th.deep : th.ink2}
                                        strokeWidth={1.8}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontFamily: th.sansBold,
                                            color: on ? th.deep : th.ink2,
                                        }}
                                    >
                                        {h.name}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* dedication stats — server-side history, not this device's count */}
                {stats && stats.allTime.sessions > 0 && (
                    <View
                        style={{ paddingHorizontal: th.d.pad, marginTop: 26 }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                color: th.muted,
                                fontFamily: th.sansBold,
                                letterSpacing: 1.2,
                                textAlign: "center",
                                marginBottom: 10,
                            }}
                        >
                            YOUR DEDICATION
                        </Text>
                        <View
                            style={{
                                borderRadius: 16,
                                borderWidth: 1.5,
                                borderColor: th.line,
                                backgroundColor: th.surface,
                                padding: 16,
                            }}
                        >
                            <View style={{ flexDirection: "row" }}>
                                {[
                                    {
                                        v: fmtMin(stats.today.minutes),
                                        l: "today",
                                    },
                                    {
                                        v: fmtMin(stats.week.minutes),
                                        l: "last 7 days",
                                    },
                                    {
                                        v: String(stats.streak),
                                        l: "day streak",
                                    },
                                ].map((t) => (
                                    <View
                                        key={t.l}
                                        style={{
                                            flex: 1,
                                            alignItems: "center",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily: th.display,
                                                fontSize: 20,
                                                color: th.ink,
                                                fontVariant: ["tabular-nums"],
                                            }}
                                        >
                                            {t.v}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: th.muted,
                                                fontFamily: th.sansBold,
                                                marginTop: 2,
                                            }}
                                        >
                                            {t.l}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {/* last 14 days, oldest → newest */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "flex-end",
                                    gap: 3,
                                    height: 48,
                                    marginTop: 16,
                                }}
                            >
                                {stats.days.map((d) => {
                                    const max = Math.max(
                                        ...stats.days.map((x) => x.minutes),
                                        1,
                                    );
                                    return (
                                        <View
                                            key={d.date}
                                            style={{
                                                flex: 1,
                                                height: "100%",
                                                justifyContent: "flex-end",
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: "100%",
                                                    borderTopLeftRadius: 3,
                                                    borderTopRightRadius: 3,
                                                    height: d.minutes
                                                        ? Math.max(
                                                              (d.minutes /
                                                                  max) *
                                                                  48,
                                                              4,
                                                          )
                                                        : 3,
                                                    backgroundColor: d.minutes
                                                        ? th.accent
                                                        : th.line,
                                                }}
                                            />
                                        </View>
                                    );
                                })}
                            </View>
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    marginTop: 4,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 10,
                                        color: th.muted,
                                        fontFamily: th.sansBold,
                                    }}
                                >
                                    2 weeks ago
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 10,
                                        color: th.muted,
                                        fontFamily: th.sansBold,
                                    }}
                                >
                                    today
                                </Text>
                            </View>

                            {stats.byHabit.length > 0 && (
                                <View
                                    style={{
                                        borderTopWidth: 1,
                                        borderTopColor: th.line,
                                        marginTop: 14,
                                        paddingTop: 12,
                                        gap: 6,
                                    }}
                                >
                                    {stats.byHabit.slice(0, 3).map((h) => (
                                        <View
                                            key={h.habitId ?? "other"}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                            }}
                                        >
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    gap: 6,
                                                }}
                                            >
                                                <Icon
                                                    name={h.icon || "sprout"}
                                                    size={14}
                                                    stroke={th.ink2}
                                                    strokeWidth={1.8}
                                                />
                                                <Text
                                                    style={{
                                                        fontSize: 12.5,
                                                        fontFamily: th.sansBold,
                                                        color: th.ink2,
                                                    }}
                                                >
                                                    {h.name}
                                                </Text>
                                            </View>
                                            <Text
                                                style={{
                                                    fontSize: 12.5,
                                                    color: th.muted,
                                                    fontFamily: th.sans,
                                                    fontVariant: [
                                                        "tabular-nums",
                                                    ],
                                                }}
                                            >
                                                {h.sessions} ·{" "}
                                                {fmtMin(h.minutes)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text
                                style={{
                                    fontSize: 11,
                                    color: th.muted,
                                    textAlign: "center",
                                    marginTop: 12,
                                    fontFamily: th.sans,
                                }}
                            >
                                All time: {stats.allTime.sessions} session
                                {stats.allTime.sessions === 1 ? "" : "s"} ·{" "}
                                {fmtMin(stats.allTime.minutes)} across{" "}
                                {stats.allTime.days} day
                                {stats.allTime.days === 1 ? "" : "s"}
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
