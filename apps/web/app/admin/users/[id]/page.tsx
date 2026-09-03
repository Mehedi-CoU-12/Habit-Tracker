"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    AccountStatus,
    deleteAdminUser,
    fetchAdminUser,
    fetchAdminUserHabits,
    recordAdminPayment,
    updateAdminUserStatus,
} from "../../../../src/lib/api";
import { toast } from "../../../../src/lib/toast";
import { deriveHabitStats } from "../../../../src/lib/deriveStats";
import { amountOn, isDayComplete } from "../../../../src/lib/completion";
import { calculateDailyProgress } from "../../../../src/utils/dailyProgress";
import { calculateWeeklyProgress } from "../../../../src/utils/weeklyProgress";
import { ApiHabit, HabitLog } from "../../../dashboard/types";
import MonthSelector from "../../../../components/MonthSelector";
import OverviewCard from "../../../../components/overview/OverviewCard";
import DailyLineChart from "../../../../components/charts/DailyLineChart";
import DonutChart from "../../../../components/charts/DonutChart";
import WeeklyOverview from "../../../../components/overview/WeeklyOverview";
import TopHabits from "../../../../components/overview/TopHabits";
import HabitGrid from "../../../../components/habits/HabitGrid";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import PaymentDialog from "../../../../components/admin/PaymentDialog";
import StatusChip from "../../../../components/admin/StatusChip";

export default function AdminUserDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

    const [approving, setApproving] = useState(false);
    const [suspending, setSuspending] = useState(false);
    const [reactivating, setReactivating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [recordingPayment, setRecordingPayment] = useState(false);

    const { data: user, isLoading } = useQuery({
        queryKey: ["admin", "user", id],
        queryFn: () => fetchAdminUser(id),
        retry: false,
    });

    const { data: rawHabits = [] } = useQuery({
        queryKey: ["admin", "user", id, "habits", selectedYear, selectedMonth],
        queryFn: () => fetchAdminUserHabits(id, selectedYear, selectedMonth),
        retry: false,
    });

    function invalidateAdmin() {
        queryClient.invalidateQueries({ queryKey: ["admin"] });
    }

    const approveMutation = useMutation({
        mutationFn: async ({
            amount,
            note,
        }: {
            amount: number | null;
            note: string;
        }) => {
            if (amount) {
                await recordAdminPayment(id, amount, note || undefined);
            }
            return updateAdminUserStatus(id, "ACTIVE", note || undefined);
        },
        onSuccess: (updated) => {
            invalidateAdmin();
            setApproving(false);
            toast.success(`${updated.name} is now active 🌱`);
        },
    });

    const statusMutation = useMutation({
        mutationFn: (status: AccountStatus) =>
            updateAdminUserStatus(id, status),
        onSuccess: (updated) => {
            invalidateAdmin();
            setSuspending(false);
            setReactivating(false);
            toast.success(
                updated.status === "SUSPENDED"
                    ? `${updated.name} suspended`
                    : `${updated.name} reactivated`,
            );
        },
    });

    const paymentMutation = useMutation({
        mutationFn: ({
            amount,
            note,
        }: {
            amount: number | null;
            note: string;
        }) => recordAdminPayment(id, amount ?? 0, note || undefined),
        onSuccess: () => {
            invalidateAdmin();
            setRecordingPayment(false);
            toast.success("Payment recorded");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteAdminUser(id),
        onSuccess: () => {
            invalidateAdmin();
            toast.success("Account deleted");
            router.push("/admin/users");
        },
    });

    if (isLoading || !user) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
            </div>
        );
    }

    // Same derivation as the user's own dashboard (D7) — identical payload,
    // identical stats, identical components.
    const daysInMonth = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).daysInMonth();
    const monthLabel = dayjs(
        `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
    ).format("MMMM YYYY");

    const habits = (rawHabits as ApiHabit[]).map((h) =>
        deriveHabitStats(h, selectedYear, selectedMonth, daysInMonth),
    );
    const logs: HabitLog[] = (rawHabits as ApiHabit[]).flatMap((h) =>
        h.logs.map((l) => ({
            habitId: h.id,
            day: l.day,
            completed: isDayComplete(h, l.day),
            amount: amountOn(h, l.day),
        })),
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

    const readOnly = () =>
        toast.info("This is a read-only view of the member's progress.");

    const isAdmin = user.role === "ADMIN";

    return (
        <div className="space-y-6">
            <Link
                href="/admin/users"
                className="inline-block text-sm font-bold text-accent transition hover:text-accent-deep"
            >
                ← All users
            </Link>

            {/* ── Profile header ── */}
            <div className="rounded-bloom border border-line bg-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="flex items-center gap-4">
                        {user.avatarUrl ? (
                            <Image
                                src={user.avatarUrl}
                                alt={user.name}
                                width={64}
                                height={64}
                                className="h-16 w-16 rounded-full object-cover ring-2 ring-accent-soft"
                            />
                        ) : (
                            <div className="grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl font-bold text-white">
                                {user.name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                        )}
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="font-display text-2xl text-ink">
                                    {user.name}
                                </h1>
                                <StatusChip status={user.status} />
                                {isAdmin && (
                                    <span className="rounded-full bg-accent-soft/60 px-2.5 py-0.5 text-xs font-bold text-accent-deep">
                                        Admin
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 text-sm text-muted">
                                {user.email}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                                Joined{" "}
                                {dayjs(user.createdAt).format("MMMM D, YYYY")}
                                {" · "}
                                {user.habitCount} habit
                                {user.habitCount === 1 ? "" : "s"}
                                {user.lastActiveAt &&
                                    ` · last active ${dayjs(user.lastActiveAt).format("MMM D, YYYY")}`}
                            </p>
                            {user.statusChangedAt && (
                                <p className="mt-1 text-xs text-muted">
                                    Status changed{" "}
                                    {dayjs(user.statusChangedAt).format(
                                        "MMM D, YYYY",
                                    )}
                                    {user.statusNote &&
                                        ` — “${user.statusNote}”`}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted">
                                Total paid
                            </p>
                            <p className="font-display text-3xl text-ink">
                                ৳{user.totalPaid}
                            </p>
                        </div>
                        {!isAdmin && (
                            <div className="flex flex-wrap justify-end gap-2">
                                {user.status !== "ACTIVE" && (
                                    <button
                                        onClick={() =>
                                            user.status === "PENDING"
                                                ? setApproving(true)
                                                : setReactivating(true)
                                        }
                                        className="cursor-pointer rounded-full bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent-deep"
                                    >
                                        {user.status === "PENDING"
                                            ? "Approve"
                                            : "Reactivate"}
                                    </button>
                                )}
                                {user.status === "ACTIVE" && (
                                    <button
                                        onClick={() => setSuspending(true)}
                                        className="cursor-pointer rounded-full border border-red-300/70 px-4 py-2 text-xs font-bold text-red-500 transition hover:bg-red-500/10"
                                    >
                                        Suspend
                                    </button>
                                )}
                                <button
                                    onClick={() => setRecordingPayment(true)}
                                    className="cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold text-ink2 transition hover:bg-surface2"
                                >
                                    Record payment
                                </button>
                                <button
                                    onClick={() => setDeleting(true)}
                                    className="cursor-pointer rounded-full border border-line px-4 py-2 text-xs font-bold text-muted transition hover:bg-red-500/10 hover:text-red-500"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Progress, exactly as the member sees it ── */}
            <MonthSelector
                year={selectedYear}
                month={selectedMonth}
                onYearChange={setSelectedYear}
                onMonthChange={setSelectedMonth}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="lg:col-span-3">
                    <DailyLineChart data={dailyData} monthLabel={monthLabel} />
                </div>
                <DonutChart completed={totalCompleted} total={totalGoal} />
            </div>

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

            <HabitGrid
                habits={habits}
                logs={logs}
                daysInMonth={daysInMonth}
                monthLabel={monthLabel}
                year={selectedYear}
                month={selectedMonth}
                onToggle={readOnly}
                onEdit={readOnly}
                onDelete={readOnly}
            />

            {/* ── Payments ── */}
            <OverviewCard
                title="Payments"
                action={
                    !isAdmin && (
                        <button
                            onClick={() => setRecordingPayment(true)}
                            className="cursor-pointer rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-accent-deep"
                        >
                            Record payment
                        </button>
                    )
                }
            >
                {user.payments.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted">
                        No payments recorded yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-line/60">
                        {user.payments.map((p) => (
                            <li
                                key={p.id}
                                className="flex items-center justify-between gap-4 px-5 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-ink">
                                        ৳{p.amount}{" "}
                                        <span className="text-xs font-normal text-muted">
                                            {p.method.toLowerCase()}
                                        </span>
                                    </p>
                                    {p.note && (
                                        <p className="truncate text-xs text-muted">
                                            {p.note}
                                        </p>
                                    )}
                                </div>
                                <span className="shrink-0 text-xs text-muted">
                                    {dayjs(p.createdAt).format("MMM D, YYYY")}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </OverviewCard>

            {/* ── Dialogs ── */}
            <PaymentDialog
                open={approving}
                title={`Approve ${user.name}?`}
                description="Their account becomes active immediately — even mid-session. Optionally record the cash you took."
                confirmLabel="Approve"
                loading={approveMutation.isPending}
                onSubmit={(payload) => approveMutation.mutate(payload)}
                onClose={() => {
                    if (!approveMutation.isPending) setApproving(false);
                }}
            />

            <PaymentDialog
                open={recordingPayment}
                title="Record a payment"
                description={`Log cash received from ${user.name} — no status change.`}
                confirmLabel="Record"
                requireAmount
                loading={paymentMutation.isPending}
                onSubmit={(payload) => paymentMutation.mutate(payload)}
                onClose={() => {
                    if (!paymentMutation.isPending) setRecordingPayment(false);
                }}
            />

            <ConfirmDialog
                open={suspending}
                tone="danger"
                title={`Suspend ${user.name}?`}
                description="They keep their data but lose access on their very next request. You can reactivate them at any time."
                confirmLabel="Suspend"
                cancelLabel="Cancel"
                loading={statusMutation.isPending}
                onConfirm={() => statusMutation.mutate("SUSPENDED")}
                onClose={() => {
                    if (!statusMutation.isPending) setSuspending(false);
                }}
            />

            <ConfirmDialog
                open={reactivating}
                title={`Reactivate ${user.name}?`}
                description="Their access is restored on their very next request."
                confirmLabel="Reactivate"
                cancelLabel="Cancel"
                loading={statusMutation.isPending}
                onConfirm={() => statusMutation.mutate("ACTIVE")}
                onClose={() => {
                    if (!statusMutation.isPending) setReactivating(false);
                }}
            />

            <ConfirmDialog
                open={deleting}
                tone="danger"
                title={`Delete ${user.name}?`}
                description="Their account, habits, check-ins and payment records are permanently removed. This can't be undone."
                confirmLabel="Delete"
                cancelLabel="Keep it"
                loading={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate()}
                onClose={() => {
                    if (!deleteMutation.isPending) setDeleting(false);
                }}
            />
        </div>
    );
}
