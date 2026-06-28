"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import DailyLineChart from "../../components/charts/DailyLineChart";
import DonutChart from "../../components/charts/DonutChart";
import WeeklyOverview from "../../components/overview/WeeklyOverview";
import HabitGrid from "../../components/habits/HabitGrid";
import Garden from "../../components/habits/Garden";
import MonthSelector from "../../components/MonthSelector";
import TopHabits from "../../components/overview/TopHabits";
import { calculateDailyProgress } from "../../src/utils/dailyProgress";
import { calculateWeeklyProgress } from "../../src/utils/weeklyProgress";
import { deriveHabitStats } from "../../src/lib/deriveStats";
import {
    fetchHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleLog,
    fetchMe,
    applyTemplate,
    CreateHabitInput,
} from "../../src/lib/api";
import { toast } from "../../src/lib/toast";
import TemplatesModal from "../../components/habits/TemplatesModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Navbar from "../../components/layout/Navbar";
import Plant from "../../components/bloom/Plant";
import BloomIcon from "../../components/bloom/BloomIcon";
import { useBloom } from "../../provider/theme";
import { ApiHabit, HabitLog, HabitWithStats } from "./types";

const ICON_CHOICES = [
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

const TOD_CHOICES: { v: string; label: string; icon: string }[] = [
    { v: "morning", label: "Morning", icon: "sun" },
    { v: "afternoon", label: "Afternoon", icon: "cloud" },
    { v: "evening", label: "Evening", icon: "moonStars" },
    { v: "anytime", label: "Anytime", icon: "sparkle" },
];

function HabitModal({
    habit,
    onClose,
    onSubmit,
    submitting,
}: {
    habit?: HabitWithStats | null;
    onClose: () => void;
    onSubmit: (input: CreateHabitInput) => void;
    submitting?: boolean;
}) {
    const isEdit = !!habit;
    const [name, setName] = useState(habit?.name ?? "");
    const [goal, setGoal] = useState(habit?.goal ?? 30);
    const [icon, setIcon] = useState(habit?.icon ?? "sprout");
    const [tod, setTod] = useState<string>(habit?.tod ?? "morning");
    const [verb, setVerb] = useState(habit?.verb ?? "");
    const [error, setError] = useState("");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setError("Give your habit a name");
            return;
        }
        if (goal < 1 || goal > 31) {
            setError("Goal must be between 1 and 31");
            return;
        }
        onSubmit({
            name: name.trim(),
            goal,
            icon,
            tod,
            verb: verb.trim() || undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--bloom-overlay) p-4">
            <div className="w-full max-w-md rounded-3xl border border-line bg-bg shadow-(--bloom-card-shadow)">
                <div className="flex items-center justify-between border-b border-line px-6 py-5">
                    <h2 className="font-display text-2xl text-ink">
                        {isEdit ? "Edit habit" : "Plant a new habit"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="cursor-pointer text-muted transition hover:text-ink"
                        aria-label="Close"
                    >
                        <BloomIcon name="x" size={22} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-6">
                    <div className="flex items-center gap-4">
                        <Plant streak={1} doneToday size={92} />
                        <div className="flex-1">
                            <input
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Run outside"
                                className="w-full border-b-2 border-line bg-transparent pb-1.5 font-display text-2xl text-ink outline-none focus:border-accent"
                            />
                            <p className="mt-2 text-xs text-muted">
                                Your seed grows as you keep the streak.
                            </p>
                        </div>
                    </div>

                    {/* Seed / icon */}
                    <div>
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
                            Seed
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {ICON_CHOICES.map((ic) => (
                                <button
                                    key={ic}
                                    type="button"
                                    onClick={() => setIcon(ic)}
                                    className={`grid aspect-square cursor-pointer place-items-center rounded-xl border transition ${
                                        icon === ic
                                            ? "border-accent bg-accent text-white"
                                            : "border-line bg-surface text-ink2 hover:border-accent"
                                    }`}
                                >
                                    <BloomIcon name={ic} size={18} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* When */}
                    <div>
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
                            When
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {TOD_CHOICES.map((o) => (
                                <button
                                    key={o.v}
                                    type="button"
                                    onClick={() => setTod(o.v)}
                                    className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border py-3 transition ${
                                        tod === o.v
                                            ? "border-ink bg-ink text-bg"
                                            : "border-line bg-surface text-ink2 hover:border-accent"
                                    }`}
                                >
                                    <BloomIcon name={o.icon} size={17} />
                                    <span className="text-[11px] font-semibold">
                                        {o.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Goal + note */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-muted">
                                Monthly goal
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={goal}
                                onChange={(e) =>
                                    setGoal(Number(e.target.value))
                                }
                                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-muted">
                                Note{" "}
                                <span className="font-normal normal-case text-muted/70">
                                    (optional)
                                </span>
                            </label>
                            <input
                                value={verb}
                                onChange={(e) => setVerb(e.target.value)}
                                placeholder="20 min"
                                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 cursor-pointer rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink2 transition hover:bg-surface2"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <BloomIcon
                                name={isEdit ? "check" : "sprout"}
                                size={16}
                                stroke="#fff"
                                strokeWidth={2}
                            />
                            {isEdit
                                ? submitting
                                    ? "Saving…"
                                    : "Save changes"
                                : submitting
                                  ? "Planting…"
                                  : "Plant it"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { layout } = useBloom();

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingHabit, setEditingHabit] = useState<HabitWithStats | null>(
        null,
    );
    const [deletingHabit, setDeletingHabit] = useState<HabitWithStats | null>(
        null,
    );
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);

    const queryKey = ["habits", selectedYear, selectedMonth];

    const { data: me } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    const {
        data: rawHabits = [],
        isLoading,
        isError,
    } = useQuery({
        queryKey,
        queryFn: () => fetchHabits(selectedYear, selectedMonth),
        retry: false,
    });

    const daysInMonth = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).daysInMonth();

    const monthLabel = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).format("MMMM YYYY");

    // Derive Bloom stats (streak / doneToday / rate …) from the month's logs
    const habits = (rawHabits as ApiHabit[]).map((h) =>
        deriveHabitStats(h, selectedYear, selectedMonth, daysInMonth),
    );

    const logs: HabitLog[] = (rawHabits as ApiHabit[]).flatMap((h) =>
        h.logs.map((l) => ({ habitId: h.id, day: l.day, completed: true })),
    );

    const totalCompleted = habits.reduce((s, h) => s + h.completed, 0);
    const totalGoal = habits.reduce((s, h) => s + h.goal, 0);

    const dailyData = calculateDailyProgress(logs, habits.length, daysInMonth);
    const weeklyData = calculateWeeklyProgress(
        logs,
        habits.length,
        selectedYear,
        selectedMonth,
    );

    const isCurrentMonth =
        selectedYear === now.getFullYear() &&
        selectedMonth === now.getMonth() + 1;
    const todayDate = now.getDate();

    // --- Mutations ---

    const toggleMutation = useMutation({
        mutationFn: ({ habitId, day }: { habitId: string; day: number }) =>
            toggleLog(habitId, selectedYear, selectedMonth, day),
        onMutate: async ({ habitId, day }) => {
            await queryClient.cancelQueries({ queryKey });
            const prev = queryClient.getQueryData<ApiHabit[]>(queryKey);
            queryClient.setQueryData<ApiHabit[]>(queryKey, (old = []) =>
                old.map((habit) => {
                    if (habit.id !== habitId) return habit;
                    const logIdx = habit.logs.findIndex((l) => l.day === day);
                    if (logIdx >= 0) {
                        return {
                            ...habit,
                            logs: habit.logs.filter((_, i) => i !== logIdx),
                        };
                    }
                    const optimistic = {
                        id: "temp",
                        habitId,
                        userId: "",
                        year: selectedYear,
                        month: selectedMonth,
                        day,
                        createdAt: "",
                    };
                    return { ...habit, logs: [...habit.logs, optimistic] };
                }),
            );
            return { prev };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey }),
    });

    const createMutation = useMutation({
        mutationFn: (input: CreateHabitInput) => createHabit(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setShowAddModal(false);
            toast.success("New habit planted 🌱");
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, input }: { id: string; input: CreateHabitInput }) =>
            updateHabit(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setEditingHabit(null);
            toast.success("Habit updated");
        },
    });

    const templateMutation = useMutation({
        mutationFn: (templateId: string) => applyTemplate(templateId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey });
            setShowTemplatesModal(false);
            toast.success(
                `Added ${data.created} habit${data.created === 1 ? "" : "s"}`,
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (habitId: string) => deleteHabit(habitId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setDeletingHabit(null);
            toast.success("Habit removed");
        },
    });

    function handleSignOut() {
        localStorage.removeItem("accessToken");
        queryClient.removeQueries({ queryKey: ["me"] });
        router.push("/");
    }

    return (
        <div className="min-h-screen bg-bg">
            <Navbar
                variant="dashboard"
                me={me}
                onAddHabit={() => setShowAddModal(true)}
                onShowTemplates={() => setShowTemplatesModal(true)}
                onSignOut={handleSignOut}
            />

            {(showAddModal || editingHabit) && (
                <HabitModal
                    key={editingHabit?.id ?? "new"}
                    habit={editingHabit}
                    submitting={
                        editingHabit
                            ? updateMutation.isPending
                            : createMutation.isPending
                    }
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingHabit(null);
                    }}
                    onSubmit={(input) => {
                        if (editingHabit) {
                            updateMutation.mutate({
                                id: editingHabit.id,
                                input,
                            });
                        } else {
                            createMutation.mutate(input);
                        }
                    }}
                />
            )}

            {showTemplatesModal && (
                <TemplatesModal
                    onClose={() => setShowTemplatesModal(false)}
                    onApply={(templateId) =>
                        templateMutation.mutate(templateId)
                    }
                    loading={templateMutation.isPending}
                />
            )}

            <ConfirmDialog
                open={!!deletingHabit}
                tone="danger"
                title="Delete this habit?"
                description={
                    <>
                        <span className="font-semibold text-ink">
                            {deletingHabit?.name}
                        </span>{" "}
                        and all of its check-ins will be permanently removed.
                        This can&apos;t be undone.
                    </>
                }
                confirmLabel="Delete"
                cancelLabel="Keep it"
                loading={deleteMutation.isPending}
                onConfirm={() => {
                    if (deletingHabit) deleteMutation.mutate(deletingHabit.id);
                }}
                onClose={() => {
                    if (!deleteMutation.isPending) setDeletingHabit(null);
                }}
            />

            <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
                <MonthSelector
                    year={selectedYear}
                    month={selectedMonth}
                    onYearChange={setSelectedYear}
                    onMonthChange={setSelectedMonth}
                />

                {isLoading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
                    </div>
                )}

                {isError && (
                    <div className="rounded-bloom border border-red-300 bg-red-500/10 px-6 py-10 text-center">
                        <p className="text-sm font-medium text-red-500">
                            Could not load habits. Make sure the API is running
                            and you are signed in.
                        </p>
                        <Link
                            href="/login"
                            className="mt-3 inline-block text-sm font-bold text-accent hover:text-accent-deep"
                        >
                            Sign in again →
                        </Link>
                    </div>
                )}

                {!isLoading && !isError && (
                    <div className="space-y-6">
                        {/* ── Garden (signature view) ── */}
                        {layout === "garden" && (
                            <Garden
                                habits={habits}
                                onToggleToday={(habitId) => {
                                    if (isCurrentMonth)
                                        toggleMutation.mutate({
                                            habitId,
                                            day: todayDate,
                                        });
                                }}
                            />
                        )}

                        {/* ── Row 1: Line chart + Donut ── */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                            <div className="lg:col-span-3">
                                <DailyLineChart
                                    data={dailyData}
                                    monthLabel={monthLabel}
                                />
                            </div>
                            <DonutChart
                                completed={totalCompleted}
                                total={totalGoal}
                            />
                        </div>

                        {/* ── Row 2: Weekly overview + Top habits ── */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                            <div className="lg:col-span-3">
                                <WeeklyOverview
                                    data={weeklyData}
                                    totalCompleted={totalCompleted}
                                    totalGoal={totalGoal}
                                />
                            </div>
                            <div className="lg:relative">
                                <div className="lg:absolute lg:inset-0">
                                    <TopHabits habits={habits} />
                                </div>
                            </div>
                        </div>

                        {/* ── Full-width habit grid ── */}
                        <HabitGrid
                            habits={habits}
                            logs={logs}
                            daysInMonth={daysInMonth}
                            monthLabel={monthLabel}
                            year={selectedYear}
                            month={selectedMonth}
                            onToggle={(habitId, day) =>
                                toggleMutation.mutate({ habitId, day })
                            }
                            onDelete={(habit) => setDeletingHabit(habit)}
                            onEdit={(habit) => setEditingHabit(habit)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
