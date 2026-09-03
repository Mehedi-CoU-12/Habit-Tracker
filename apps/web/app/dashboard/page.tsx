"use client";

import Link from "next/link";
import MonthSelector from "../../components/MonthSelector";
import Navbar from "../../components/layout/Navbar";
import HabitModal from "../../components/habits/HabitModal";
import TemplatesModal from "../../components/habits/TemplatesModal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import DashboardContent from "../../components/dashboard/DashboardContent";
import { useDashboard } from "./useDashboard";

export default function DashboardPage() {
    const dash = useDashboard();

    return (
        <div className="min-h-screen bg-bg">
            <Navbar
                variant="dashboard"
                me={dash.me}
                onAddHabit={() => dash.setShowAddModal(true)}
                onShowTemplates={() => dash.setShowTemplatesModal(true)}
                onSignOut={dash.handleSignOut}
            />

            {/* ── Overlays ── */}
            {(dash.showAddModal || dash.editingHabit) && (
                <HabitModal
                    key={dash.editingHabit?.id ?? "new"}
                    habit={dash.editingHabit}
                    submitting={
                        dash.editingHabit
                            ? dash.updateMutation.isPending
                            : dash.createMutation.isPending
                    }
                    onClose={() => {
                        dash.setShowAddModal(false);
                        dash.setEditingHabit(null);
                    }}
                    onSubmit={(input) => {
                        if (dash.editingHabit) {
                            dash.updateMutation.mutate({
                                id: dash.editingHabit.id,
                                input,
                            });
                        } else {
                            dash.createMutation.mutate(input);
                        }
                    }}
                />
            )}

            {dash.showTemplatesModal && (
                <TemplatesModal
                    onClose={() => dash.setShowTemplatesModal(false)}
                    onApply={(templateId) =>
                        dash.templateMutation.mutate(templateId)
                    }
                    loading={dash.templateMutation.isPending}
                />
            )}

            <ConfirmDialog
                open={!!dash.deletingHabit}
                tone="danger"
                title="Delete this habit?"
                description={
                    <>
                        <span className="font-semibold text-ink">
                            {dash.deletingHabit?.name}
                        </span>{" "}
                        and all of its check-ins will be permanently removed.
                        This can&apos;t be undone.
                    </>
                }
                confirmLabel="Delete"
                cancelLabel="Keep it"
                loading={dash.deleteMutation.isPending}
                onConfirm={() => {
                    if (dash.deletingHabit)
                        dash.deleteMutation.mutate(dash.deletingHabit.id);
                }}
                onClose={() => {
                    if (!dash.deleteMutation.isPending)
                        dash.setDeletingHabit(null);
                }}
            />

            {/* ── Page body ── */}
            <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
                <MonthSelector
                    year={dash.selectedYear}
                    month={dash.selectedMonth}
                    onYearChange={dash.setSelectedYear}
                    onMonthChange={dash.setSelectedMonth}
                />

                {dash.isLoading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
                    </div>
                )}

                {dash.isError && (
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

                {!dash.isLoading && !dash.isError && (
                    <DashboardContent
                        habits={dash.habits}
                        logs={dash.logs}
                        daysInMonth={dash.daysInMonth}
                        monthLabel={dash.monthLabel}
                        year={dash.selectedYear}
                        month={dash.selectedMonth}
                        totalCompleted={dash.totalCompleted}
                        totalGoal={dash.totalGoal}
                        dailyData={dash.dailyData}
                        weeklyData={dash.weeklyData}
                        onToggle={(habitId, day) =>
                            dash.toggleMutation.mutate({ habitId, day })
                        }
                        onSkip={(habitId, day, used) =>
                            dash.skipMutation.mutate({ habitId, day, used })
                        }
                        onToggleToday={(habitId) => {
                            if (dash.isCurrentMonth)
                                dash.toggleMutation.mutate({
                                    habitId,
                                    day: dash.todayDate,
                                });
                        }}
                        onEdit={(habit) => dash.setEditingHabit(habit)}
                        onDelete={(habit) => dash.setDeletingHabit(habit)}
                    />
                )}
            </div>
        </div>
    );
}
