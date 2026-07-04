"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    AccountStatus,
    AdminUserRow,
    deleteAdminUser,
    fetchAdminStats,
    fetchAdminUsers,
    recordAdminPayment,
    updateAdminUserStatus,
} from "../../../src/lib/api";
import { toast } from "../../../src/lib/toast";
import OverviewCard from "../../../components/overview/OverviewCard";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import PaymentDialog from "../../../components/admin/PaymentDialog";
import StatusChip from "../../../components/admin/StatusChip";

const PAGE_SIZE = 20;

type StatusFilter = AccountStatus | "ALL";

// Pending first — that's the money queue.
const TABS: { key: StatusFilter; label: string }[] = [
    { key: "PENDING", label: "Pending" },
    { key: "ACTIVE", label: "Active" },
    { key: "SUSPENDED", label: "Suspended" },
    { key: "ALL", label: "All" },
];

function Avatar({ user }: { user: AdminUserRow }) {
    return user.avatarUrl ? (
        <Image
            src={user.avatarUrl}
            alt={user.name}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover ring-2 ring-accent-soft"
        />
    ) : (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">
            {user.name?.[0]?.toUpperCase() ?? "?"}
        </div>
    );
}

function UsersPageInner() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();

    const initialStatus = searchParams.get("status");
    const [status, setStatus] = useState<StatusFilter>(
        initialStatus === "PENDING" ||
            initialStatus === "ACTIVE" ||
            initialStatus === "SUSPENDED"
            ? initialStatus
            : "ALL",
    );
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    // Which action is pending user confirmation (one dialog at a time).
    const [approving, setApproving] = useState<AdminUserRow | null>(null);
    const [suspending, setSuspending] = useState<AdminUserRow | null>(null);
    const [reactivating, setReactivating] = useState<AdminUserRow | null>(
        null,
    );
    const [deleting, setDeleting] = useState<AdminUserRow | null>(null);

    // Debounce the search box into the actual query filter.
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    const filters = {
        ...(status !== "ALL" ? { status } : {}),
        ...(search ? { search } : {}),
        page,
        pageSize: PAGE_SIZE,
    };

    const { data, isLoading, isError } = useQuery({
        queryKey: ["admin", "users", filters],
        queryFn: () => fetchAdminUsers(filters),
        retry: false,
        placeholderData: (prev) => prev,
    });

    // Tab counts come from the stats endpoint (cached across admin pages).
    const { data: stats } = useQuery({
        queryKey: ["admin", "stats"],
        queryFn: fetchAdminStats,
        retry: false,
    });

    function invalidateAdmin() {
        queryClient.invalidateQueries({ queryKey: ["admin"] });
    }

    const approveMutation = useMutation({
        mutationFn: async ({
            user,
            amount,
            note,
        }: {
            user: AdminUserRow;
            amount: number | null;
            note: string;
        }) => {
            // Two calls by design: payments can also exist without a status
            // change (renewals), so the API keeps them separate.
            if (amount) {
                await recordAdminPayment(user.id, amount, note || undefined);
            }
            return updateAdminUserStatus(user.id, "ACTIVE", note || undefined);
        },
        onSuccess: (updated) => {
            invalidateAdmin();
            setApproving(null);
            toast.success(`${updated.name} is now active 🌱`);
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({
            user,
            status: next,
        }: {
            user: AdminUserRow;
            status: AccountStatus;
        }) => updateAdminUserStatus(user.id, next),
        onSuccess: (updated) => {
            invalidateAdmin();
            setSuspending(null);
            setReactivating(null);
            toast.success(
                updated.status === "SUSPENDED"
                    ? `${updated.name} suspended`
                    : `${updated.name} reactivated`,
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (user: AdminUserRow) => deleteAdminUser(user.id),
        onSuccess: () => {
            invalidateAdmin();
            setDeleting(null);
            toast.success("Account deleted");
        },
    });

    const users = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function tabCount(key: StatusFilter): number | null {
        if (!stats) return null;
        if (key === "ALL") return stats.totalUsers;
        return stats.usersByStatus[key];
    }

    return (
        <div className="space-y-6">
            <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">
                    Admin
                </p>
                <h1 className="font-display text-4xl tracking-tight text-ink">
                    Users
                </h1>
            </div>

            {/* Filter row: status tabs + search */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
                    {TABS.map((tab) => {
                        const count = tabCount(tab.key);
                        return (
                            <button
                                key={tab.key}
                                onClick={() => {
                                    setStatus(tab.key);
                                    setPage(1);
                                }}
                                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                                    status === tab.key
                                        ? "bg-accent text-white"
                                        : "text-ink2 hover:bg-surface2"
                                }`}
                            >
                                {tab.label}
                                {count !== null ? ` (${count})` : ""}
                            </button>
                        );
                    })}
                </div>

                <input
                    type="search"
                    placeholder="Search name or email…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-64 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                />
            </div>

            <OverviewCard>
                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
                    </div>
                ) : isError ? (
                    <p className="px-6 py-12 text-center text-sm font-medium text-red-500">
                        Could not load users.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-line bg-surface2/50 text-xs">
                                    <th className="sticky left-0 z-10 bg-surface2/50 px-4 py-3 text-left font-bold text-ink2">
                                        User
                                    </th>
                                    <th className="px-3 py-3 text-left font-semibold text-muted">
                                        Status
                                    </th>
                                    <th className="px-3 py-3 text-center font-semibold text-muted">
                                        Habits
                                    </th>
                                    <th className="px-3 py-3 text-left font-semibold text-muted">
                                        Last active
                                    </th>
                                    <th className="px-3 py-3 text-right font-semibold text-muted">
                                        Paid
                                    </th>
                                    <th className="px-3 py-3 text-left font-semibold text-muted">
                                        Joined
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user, idx) => (
                                    <tr
                                        key={user.id}
                                        className={`border-b border-line/60 ${
                                            idx % 2 === 0
                                                ? "bg-surface"
                                                : "bg-surface2/30"
                                        }`}
                                    >
                                        <td className="sticky left-0 z-10 bg-inherit px-4 py-3">
                                            <Link
                                                href={`/admin/users/${user.id}`}
                                                className="flex items-center gap-3"
                                            >
                                                <Avatar user={user} />
                                                <span className="min-w-0">
                                                    <span className="block max-w-44 truncate font-semibold text-ink hover:text-accent">
                                                        {user.name}
                                                        {user.role ===
                                                            "ADMIN" && (
                                                            <span className="ml-1.5 rounded-full bg-accent-soft/60 px-1.5 py-0.5 text-[10px] font-bold text-accent-deep">
                                                                Admin
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="block max-w-44 truncate text-xs text-muted">
                                                        {user.email}
                                                    </span>
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3">
                                            <StatusChip status={user.status} />
                                        </td>
                                        <td className="px-3 py-3 text-center tabular-nums text-ink2">
                                            {user.habitCount}
                                        </td>
                                        <td className="px-3 py-3 text-ink2">
                                            {user.lastActiveAt
                                                ? dayjs(
                                                      user.lastActiveAt,
                                                  ).format("MMM D, YYYY")
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums text-ink2">
                                            {user.totalPaid > 0
                                                ? `৳${user.totalPaid}`
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-3 text-ink2">
                                            {dayjs(user.createdAt).format(
                                                "MMM D, YYYY",
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                {user.role === "ADMIN" ? (
                                                    <span className="text-xs text-muted">
                                                        —
                                                    </span>
                                                ) : (
                                                    <>
                                                        {user.status !==
                                                            "ACTIVE" && (
                                                            <button
                                                                onClick={() =>
                                                                    user.status ===
                                                                    "PENDING"
                                                                        ? setApproving(
                                                                              user,
                                                                          )
                                                                        : setReactivating(
                                                                              user,
                                                                          )
                                                                }
                                                                className="cursor-pointer rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-accent-deep"
                                                            >
                                                                {user.status ===
                                                                "PENDING"
                                                                    ? "Approve"
                                                                    : "Reactivate"}
                                                            </button>
                                                        )}
                                                        {user.status ===
                                                            "ACTIVE" && (
                                                            <button
                                                                onClick={() =>
                                                                    setSuspending(
                                                                        user,
                                                                    )
                                                                }
                                                                className="cursor-pointer rounded-full border border-red-300/70 px-3 py-1.5 text-xs font-bold text-red-500 transition hover:bg-red-500/10"
                                                            >
                                                                Suspend
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() =>
                                                                setDeleting(
                                                                    user,
                                                                )
                                                            }
                                                            className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted transition hover:bg-red-500/10 hover:text-red-500"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-16 text-center text-sm text-muted"
                                        >
                                            {search
                                                ? "No users match your search."
                                                : "No users here."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {total > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
                        <span className="text-xs text-muted">
                            {total} user{total === 1 ? "" : "s"}
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setPage((p) => p - 1)}
                                disabled={page <= 1}
                                className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink2 transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                ← Prev
                            </button>
                            <span className="text-xs text-muted">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page >= totalPages}
                                className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink2 transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </OverviewCard>

            {/* ── Dialogs ── */}
            <PaymentDialog
                open={!!approving}
                title={`Approve ${approving?.name ?? ""}?`}
                description="Their account becomes active immediately — even mid-session. Optionally record the cash you took."
                confirmLabel="Approve"
                loading={approveMutation.isPending}
                onSubmit={({ amount, note }) => {
                    if (approving)
                        approveMutation.mutate({
                            user: approving,
                            amount,
                            note,
                        });
                }}
                onClose={() => {
                    if (!approveMutation.isPending) setApproving(null);
                }}
            />

            <ConfirmDialog
                open={!!suspending}
                tone="danger"
                title={`Suspend ${suspending?.name ?? ""}?`}
                description="They keep their data but lose access on their very next request. You can reactivate them at any time."
                confirmLabel="Suspend"
                cancelLabel="Cancel"
                loading={statusMutation.isPending}
                onConfirm={() => {
                    if (suspending)
                        statusMutation.mutate({
                            user: suspending,
                            status: "SUSPENDED",
                        });
                }}
                onClose={() => {
                    if (!statusMutation.isPending) setSuspending(null);
                }}
            />

            <ConfirmDialog
                open={!!reactivating}
                title={`Reactivate ${reactivating?.name ?? ""}?`}
                description="Their access is restored on their very next request."
                confirmLabel="Reactivate"
                cancelLabel="Cancel"
                loading={statusMutation.isPending}
                onConfirm={() => {
                    if (reactivating)
                        statusMutation.mutate({
                            user: reactivating,
                            status: "ACTIVE",
                        });
                }}
                onClose={() => {
                    if (!statusMutation.isPending) setReactivating(null);
                }}
            />

            <ConfirmDialog
                open={!!deleting}
                tone="danger"
                title={`Delete ${deleting?.name ?? ""}?`}
                description="Their account, habits, check-ins and payment records are permanently removed. This can't be undone."
                confirmLabel="Delete"
                cancelLabel="Keep it"
                loading={deleteMutation.isPending}
                onConfirm={() => {
                    if (deleting) deleteMutation.mutate(deleting);
                }}
                onClose={() => {
                    if (!deleteMutation.isPending) setDeleting(null);
                }}
            />
        </div>
    );
}

export default function AdminUsersPage() {
    // useSearchParams (the ?status=PENDING deep link) requires a Suspense
    // boundary at prerender time.
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-24">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
                </div>
            }
        >
            <UsersPageInner />
        </Suspense>
    );
}
