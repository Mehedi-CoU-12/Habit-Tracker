"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    fetchFocusStats,
    fetchHabits,
    recordFocusSession,
    toggleLog,
} from "../../src/lib/api";
import { deriveHabitStats } from "../../src/lib/deriveStats";
import { isDayComplete } from "../../src/lib/completion";
import { ApiHabit } from "../dashboard/types";
import BloomIcon from "../../components/bloom/BloomIcon";
import Plant from "../../components/bloom/Plant";
import { Sparkles } from "../../components/bloom/primitives";
import { playSound, useSoundPrefs } from "../../src/lib/sound";

/**
 * Bloom focus timer — a Pomodoro folded into the garden metaphor. A focus
 * session is sunlight: the glow behind the habit's plant intensifies as the
 * ring fills, and finishing a session waters that habit for the day. Breaks
 * are quiet rest. Spec: design/focus/FOCUS_TIMER.md.
 *
 * Timekeeping is timestamp-based (`endsAt`), so background-tab throttling and
 * reloads can't drift the countdown; the whole state persists to localStorage
 * and a reload while running resumes seamlessly.
 */

type Mode = "focus" | "short" | "long";

type FocusPersist = {
    focusMin: number;
    mode: Mode;
    remaining: number;
    running: boolean;
    endsAt: number | null;
    sessions: number;
    /** Date of `sessions` (YYYY-MM-DD) — a new day starts the count over. */
    day: string;
    habitId: string | null;
};

const LS_KEY = "bloom-focus-v1";
const PRESETS = [15, 25, 50];
const breakLen = (m: Mode) => (m === "long" ? 15 : 5);

const fmt = (s: number) => {
    const m = Math.floor(Math.max(0, s) / 60);
    const ss = Math.max(0, s) % 60;
    return `${m}:${String(ss).padStart(2, "0")}`;
};

const fmtMin = (m: number) =>
    m >= 60
        ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim()
        : `${m}m`;

const todayKey = (d?: Date) => dayjs(d).format("YYYY-MM-DD");

const tint = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export default function FocusPage() {
    const queryClient = useQueryClient();
    const soundPrefs = useSoundPrefs();

    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysInMonth = dayjs(now).daysInMonth();
    const queryKey = useMemo(() => ["habits", year, month], [year, month]);

    const { data: rawHabits = [], isLoading } = useQuery({
        queryKey,
        queryFn: () => fetchHabits(year, month),
        retry: false,
    });
    const habits = (rawHabits as ApiHabit[]).map((h) =>
        deriveHabitStats(h, year, month, daysInMonth),
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

    // Latest values for interval/visibility/unmount closures.
    const ref = useRef({
        focusMin,
        mode,
        sessions,
        remaining,
        running,
        habitId,
    });
    ref.current = { focusMin, mode, sessions, remaining, running, habitId };

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
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(data));
        } catch {
            /* storage blocked — the in-memory timer still works */
        }
    }, []);

    // Add-only optimistic log so the plant perks up the moment a session ends
    // (and the done-today guard sees it immediately).
    const waterMutation = useMutation({
        mutationFn: ({ habitId: id, day }: { habitId: string; day: number }) =>
            toggleLog(id, year, month, day),
        onMutate: async ({ habitId: id, day }) => {
            await queryClient.cancelQueries({ queryKey });
            queryClient.setQueryData<ApiHabit[]>(queryKey, (old = []) =>
                old.map((h) =>
                    h.id === id && !isDayComplete(h, day)
                        ? {
                              ...h,
                              logs: [
                                  ...h.logs,
                                  {
                                      id: "temp",
                                      habitId: id,
                                      userId: "",
                                      year,
                                      month,
                                      day,
                                      createdAt: "",
                                  },
                              ],
                          }
                        : h,
                ),
            );
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey }),
    });

    /** Water the habit (mark done today) — never un-completes. */
    const waterHabit = useCallback(
        (id: string) => {
            const d = new Date();
            const habit = queryClient
                .getQueryData<ApiHabit[]>(queryKey)
                ?.find((h) => h.id === id);
            const done = !!habit && isDayComplete(habit, d.getDate());
            if (!done) waterMutation.mutate({ habitId: id, day: d.getDate() });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [queryKey],
    );

    // Dedication stats live on the server (FocusSession), so they survive
    // devices and days — unlike the localStorage timer state.
    const { data: stats } = useQuery({
        queryKey: ["focusStats"],
        queryFn: () => {
            const d = new Date();
            return fetchFocusStats(
                d.getFullYear(),
                d.getMonth() + 1,
                d.getDate(),
            );
        },
        retry: false,
        staleTime: 60 * 1000,
    });

    /** Report a finished focus session — best-effort; the timer never waits. */
    const recordSession = useCallback(
        (id: string | null, minutes: number) => {
            const d = new Date();
            recordFocusSession({
                ...(id ? { habitId: id } : {}),
                minutes,
                year: d.getFullYear(),
                month: d.getMonth() + 1,
                day: d.getDate(),
            })
                .then(() =>
                    queryClient.invalidateQueries({
                        queryKey: ["focusStats"],
                    }),
                )
                .catch(() => {
                    /* offline / API down — the local timer state is unaffected */
                });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // ── Hydrate persisted state (client-only, after first paint) ────────────
    useEffect(() => {
        let p: Partial<FocusPersist> = {};
        try {
            p = JSON.parse(
                localStorage.getItem(LS_KEY) ?? "{}",
            ) as Partial<FocusPersist>;
        } catch {
            /* corrupt state → defaults */
        }
        const today = todayKey();
        const fm =
            typeof p.focusMin === "number" && PRESETS.includes(p.focusMin)
                ? p.focusMin
                : 25;
        let nextMode: Mode =
            p.mode === "short" || p.mode === "long" ? p.mode : "focus";
        let nextSessions =
            p.day === today && typeof p.sessions === "number" ? p.sessions : 0;
        const paramHabit = new URLSearchParams(window.location.search).get(
            "habit",
        );
        const nextHabitId =
            paramHabit ?? (typeof p.habitId === "string" ? p.habitId : null);

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
                    recordSession(nextHabitId, fm);
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
            const max = (nextMode === "focus" ? fm : breakLen(nextMode)) * 60;
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
        try {
            localStorage.setItem(
                LS_KEY,
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
        } catch {
            /* ignore */
        }
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
            const id = c.habitId ?? habit?.id;
            if (id) waterHabit(id);
            recordSession(id ?? null, c.focusMin);
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

    // ── Ticking (timestamp-based; tolerates background-tab throttling) ──────
    useEffect(() => {
        if (!running || !hydrated) return;
        if (!endsAtRef.current) {
            endsAtRef.current = Date.now() + ref.current.remaining * 1000;
        }
        const tick = () => {
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
        };
        const id = setInterval(tick, 250);
        // Re-sync the instant the tab becomes visible again — throttled
        // intervals can lag, and the user should never see a stale time.
        const onVis = () => {
            if (document.visibilityState === "visible") tick();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            clearInterval(id);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [running, hydrated, complete]);

    // Countdown in the tab title while running, so a backgrounded session
    // stays glanceable.
    useEffect(() => {
        if (!running) return;
        document.title = `${fmt(remaining)} · Focus — HabitFlow`;
        return () => {
            document.title = "HabitFlow";
        };
    }, [running, remaining]);

    useEffect(
        () => () => {
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
        setRemaining(d);
        persistNow({ running: false, endsAt: null, remaining: d });
    };

    const onSkip = () => {
        setRunning(false);
        endsAtRef.current = null;
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

    // ── Loading / empty garden guards ────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-bg">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
            </div>
        );
    }

    if (!habit) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-8 text-center">
                <Plant streak={0} doneToday size={110} />
                <h1 className="font-display text-2xl text-ink">
                    Nothing to grow yet
                </h1>
                <p className="max-w-xs text-sm text-muted">
                    Plant a habit first — then give it sunlight with a focus
                    session.
                </p>
                <Link
                    href="/dashboard"
                    className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-deep"
                >
                    Back to garden
                </Link>
            </div>
        );
    }

    // ── Ring geometry & visuals ──────────────────────────────────────────────
    const R = 130;
    const C = 2 * Math.PI * R;
    const total = durOf(mode);
    const progress = total > 0 ? Math.min(1, 1 - remaining / total) : 0;
    const isFocus = mode === "focus";
    const ringVar = isFocus ? "var(--bloom-accent)" : "var(--bloom-green)";
    const chipVar = isFocus
        ? "var(--bloom-accent-deep)"
        : "var(--bloom-green-deep)";
    const glow = isFocus ? progress : 0;
    const modeLabel = isFocus
        ? "Focus"
        : mode === "long"
          ? "Long break"
          : "Short break";
    const filledDots =
        sessions % 4 === 0 ? (sessions > 0 ? 4 : 0) : sessions % 4;

    const roundBtn =
        "grid h-10 w-10 cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-surface transition hover:bg-surface2";

    return (
        <div className="relative min-h-screen bg-bg">
            {/* soft wash matching the mode */}
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-80"
                style={{
                    background: `linear-gradient(180deg, ${tint(ringVar, 20)} 0%, var(--bloom-bg) 100%)`,
                }}
            />

            <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-8 pt-5">
                {/* top bar */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/dashboard"
                        className={roundBtn}
                        title="Back to garden"
                    >
                        <BloomIcon name="chevronLeft" size={18} />
                    </Link>
                    <span className="text-[13px] font-bold tracking-[0.08em] text-muted">
                        FOCUS
                    </span>
                    <Link
                        href="/focus/sound"
                        className={roundBtn}
                        title="Session sounds"
                    >
                        <BloomIcon
                            name={soundPrefs.on ? "volume" : "volumeOff"}
                            size={17}
                            strokeWidth={1.8}
                        />
                    </Link>
                </div>

                {/* mode chip + habit */}
                <div className="mt-2 text-center">
                    <span
                        className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
                        style={{
                            background: tint(ringVar, 18),
                            color: chipVar,
                        }}
                    >
                        <BloomIcon
                            name={isFocus ? "sun" : "coffee"}
                            size={15}
                            strokeWidth={1.8}
                        />
                        <span className="text-[13px] font-bold">
                            {modeLabel}
                        </span>
                    </span>
                    <p className="mt-2.5 text-sm text-ink2">
                        {isFocus ? "Growing" : "Resting"}{" "}
                        <span className="font-bold text-ink">{habit.name}</span>
                    </p>
                </div>

                {/* timer ring with plant */}
                <div className="my-3 flex items-center justify-center">
                    <div className="relative h-[300px] w-[300px]">
                        {/* sun glow that intensifies with progress */}
                        <div
                            className="absolute left-1/2 top-1/2 h-[200px] w-[200px] rounded-full transition-all duration-700 ease-out"
                            style={{
                                transform: `translate(-50%,-50%) scale(${0.7 + glow * 0.5})`,
                                background: `radial-gradient(circle, ${tint("var(--bloom-sun)", 50)} 0%, transparent 70%)`,
                                opacity: 0.3 + glow * 0.7,
                            }}
                        />
                        <svg
                            width={300}
                            height={300}
                            className="absolute inset-0 -rotate-90"
                        >
                            <circle
                                cx={150}
                                cy={150}
                                r={R}
                                fill="none"
                                strokeWidth={10}
                                style={{ stroke: "var(--bloom-line)" }}
                            />
                            <circle
                                cx={150}
                                cy={150}
                                r={R}
                                fill="none"
                                strokeWidth={10}
                                strokeLinecap="round"
                                strokeDasharray={C}
                                strokeDashoffset={C * (1 - progress)}
                                style={{
                                    stroke: ringVar,
                                    transition: running
                                        ? "stroke-dashoffset 1s linear"
                                        : "stroke-dashoffset .3s",
                                }}
                            />
                        </svg>
                        {/* center: plant + time */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="relative">
                                <Plant
                                    streak={habit.streak}
                                    doneToday
                                    size={96}
                                />
                                <Sparkles show={justDone} />
                            </div>
                            <div className="-mt-2 font-display text-[52px] leading-none text-ink tabular-nums">
                                {fmt(remaining)}
                            </div>
                            <div
                                className="mt-1.5 text-[11.5px] font-semibold"
                                style={{
                                    color: justDone
                                        ? "var(--bloom-green-deep)"
                                        : "var(--bloom-muted)",
                                }}
                            >
                                {justDone
                                    ? "🌱 Session complete!"
                                    : running
                                      ? "in progress"
                                      : "paused"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* session dots */}
                <div className="flex items-center justify-center gap-2">
                    {[0, 1, 2, 3].map((i) => (
                        <span
                            key={i}
                            className="h-[9px] w-[9px] rounded-full"
                            style={{
                                background:
                                    filledDots > i
                                        ? "var(--bloom-accent)"
                                        : "var(--bloom-line)",
                            }}
                        />
                    ))}
                    <span className="ml-2 text-xs font-semibold text-muted">
                        {sessions} today
                    </span>
                </div>

                {/* presets (idle, focus mode only) */}
                {!running && isFocus && (
                    <div className="mt-3.5 flex justify-center gap-2">
                        {PRESETS.map((p) => {
                            const on = focusMin === p;
                            return (
                                <button
                                    key={p}
                                    onClick={() => onPreset(p)}
                                    className="cursor-pointer rounded-full border-[1.5px] px-4 py-2 text-[13px] font-bold transition"
                                    style={{
                                        borderColor: on
                                            ? "var(--bloom-accent)"
                                            : "var(--bloom-line)",
                                        background: on
                                            ? tint("var(--bloom-accent)", 12)
                                            : "var(--bloom-surface)",
                                        color: on
                                            ? "var(--bloom-accent-deep)"
                                            : "var(--bloom-ink2)",
                                    }}
                                >
                                    {p} min
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* controls */}
                <div className="flex items-center justify-center gap-4 py-4">
                    <button
                        onClick={onReset}
                        title="Reset"
                        className="grid h-[52px] w-[52px] cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-surface transition hover:bg-surface2"
                    >
                        <BloomIcon name="chevronLeft" size={20} />
                    </button>
                    <button
                        onClick={onToggle}
                        title={running ? "Pause" : "Start"}
                        className="grid h-[84px] w-[84px] cursor-pointer place-items-center rounded-full transition active:scale-[0.97]"
                        style={{
                            background: running
                                ? "var(--bloom-surface)"
                                : ringVar,
                            border: running ? `2px solid ${ringVar}` : "none",
                            boxShadow: running
                                ? "none"
                                : `0 8px 24px ${tint(ringVar, 45)}`,
                        }}
                    >
                        {running ? (
                            <svg
                                width={26}
                                height={26}
                                viewBox="0 0 24 24"
                                style={{ fill: ringVar }}
                            >
                                <rect
                                    x={6}
                                    y={5}
                                    width={4}
                                    height={14}
                                    rx={1.5}
                                />
                                <rect
                                    x={14}
                                    y={5}
                                    width={4}
                                    height={14}
                                    rx={1.5}
                                />
                            </svg>
                        ) : (
                            <svg
                                width={30}
                                height={30}
                                viewBox="0 0 24 24"
                                fill="#fff"
                                className="ml-1"
                            >
                                <path d="M7 5 v14 l12 -7 z" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={onSkip}
                        title="Skip"
                        className="grid h-[52px] w-[52px] cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-surface transition hover:bg-surface2"
                    >
                        <svg
                            width={20}
                            height={20}
                            viewBox="0 0 24 24"
                            fill="none"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ stroke: "var(--bloom-ink2)" }}
                        >
                            <path d="M5 5 l9 7 l-9 7 z" />
                            <line x1={18} y1={5} x2={18} y2={19} />
                        </svg>
                    </button>
                </div>

                {/* switch habit */}
                <div className="pt-1">
                    <p className="mb-2.5 text-center text-[11px] font-bold tracking-[0.1em] text-muted">
                        FOCUS ON
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        {habits.map((h) => {
                            const on = h.id === habit.id;
                            return (
                                <button
                                    key={h.id}
                                    onClick={() => onPickHabit(h.id)}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold transition"
                                    style={{
                                        borderColor: on
                                            ? "var(--bloom-accent)"
                                            : "var(--bloom-line)",
                                        background: on
                                            ? tint("var(--bloom-accent)", 12)
                                            : "var(--bloom-surface)",
                                        color: on
                                            ? "var(--bloom-accent-deep)"
                                            : "var(--bloom-ink2)",
                                    }}
                                >
                                    <BloomIcon
                                        name={h.icon || "sprout"}
                                        size={15}
                                        strokeWidth={1.8}
                                    />
                                    {h.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* dedication stats — server-side history, not this device's count */}
                {stats && stats.allTime.sessions > 0 && (
                    <div className="mt-7">
                        <p className="mb-2.5 text-center text-[11px] font-bold tracking-[0.1em] text-muted">
                            YOUR DEDICATION
                        </p>
                        <div className="rounded-2xl border-[1.5px] border-line bg-surface p-4">
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <div className="font-display text-xl leading-tight text-ink tabular-nums">
                                        {fmtMin(stats.today.minutes)}
                                    </div>
                                    <div className="mt-0.5 text-[11px] font-semibold text-muted">
                                        today
                                    </div>
                                </div>
                                <div>
                                    <div className="font-display text-xl leading-tight text-ink tabular-nums">
                                        {fmtMin(stats.week.minutes)}
                                    </div>
                                    <div className="mt-0.5 text-[11px] font-semibold text-muted">
                                        last 7 days
                                    </div>
                                </div>
                                <div>
                                    <div className="font-display text-xl leading-tight text-ink tabular-nums">
                                        {stats.streak}
                                    </div>
                                    <div className="mt-0.5 text-[11px] font-semibold text-muted">
                                        day streak
                                    </div>
                                </div>
                            </div>

                            {/* last 14 days, oldest → newest */}
                            <div className="mt-4 flex h-12 items-end gap-[3px]">
                                {stats.days.map((d) => {
                                    const max = Math.max(
                                        ...stats.days.map((x) => x.minutes),
                                        1,
                                    );
                                    return (
                                        <div
                                            key={d.date}
                                            title={`${d.date} · ${d.sessions} session${d.sessions === 1 ? "" : "s"} · ${fmtMin(d.minutes)}`}
                                            className="flex flex-1 items-end self-stretch"
                                        >
                                            <div
                                                className="w-full rounded-t-[3px]"
                                                style={{
                                                    height: d.minutes
                                                        ? `${Math.max((d.minutes / max) * 100, 8)}%`
                                                        : "3px",
                                                    background: d.minutes
                                                        ? "var(--bloom-accent)"
                                                        : "var(--bloom-line)",
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted">
                                <span>2 weeks ago</span>
                                <span>today</span>
                            </div>

                            {stats.byHabit.length > 0 && (
                                <div className="mt-3.5 space-y-1.5 border-t border-line pt-3">
                                    {stats.byHabit.slice(0, 3).map((h) => (
                                        <div
                                            key={h.habitId ?? "other"}
                                            className="flex items-center justify-between text-[12.5px]"
                                        >
                                            <span className="flex items-center gap-1.5 font-semibold text-ink2">
                                                <BloomIcon
                                                    name={h.icon || "sprout"}
                                                    size={14}
                                                    strokeWidth={1.8}
                                                />
                                                {h.name}
                                            </span>
                                            <span className="text-muted tabular-nums">
                                                {h.sessions} ·{" "}
                                                {fmtMin(h.minutes)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="mt-3 text-center text-[11px] text-muted">
                                All time: {stats.allTime.sessions} session
                                {stats.allTime.sessions === 1 ? "" : "s"} ·{" "}
                                {fmtMin(stats.allTime.minutes)} across{" "}
                                {stats.allTime.days} day
                                {stats.allTime.days === 1 ? "" : "s"}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
