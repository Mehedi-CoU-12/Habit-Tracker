"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { AccountStatus, AdminStats, fetchAdminStats } from "../../src/lib/api";
import OverviewCard from "../../components/overview/OverviewCard";
import { ACCENTS, NEUTRALS, useBloom } from "../../provider/theme";

// Status palette, one set per mode — validated against the Bloom surfaces
// (lightness band, chroma, CVD separation, contrast). The legend always
// carries label + count, so color is never the only signal.
const STATUS_COLORS: Record<"light" | "dark", Record<AccountStatus, string>> =
    {
        light: { ACTIVE: "#6FA86B", PENDING: "#f59e0b", SUSPENDED: "#ef4444" },
        dark: { ACTIVE: "#5da158", PENDING: "#d97706", SUSPENDED: "#ef4444" },
    };

function StatCard({
    label,
    value,
    sub,
    href,
    warn,
}: {
    label: string;
    value: number;
    sub?: string;
    href?: string;
    warn?: boolean;
}) {
    const body = (
        <div
            className={`h-full rounded-bloom border bg-surface p-5 transition ${
                warn
                    ? "border-amber-500/50"
                    : "border-line"
            } ${href ? "hover:-translate-y-0.5 hover:shadow-(--bloom-card-shadow)" : ""}`}
        >
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted">
                {warn && <span aria-hidden>⚠️</span>}
                {label}
            </p>
            <p className="mt-2 font-display text-4xl text-ink">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
            {href && (
                <p className="mt-2 text-xs font-bold text-accent">Review →</p>
            )}
        </div>
    );
    return href ? <Link href={href}>{body}</Link> : body;
}

function SignupsTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
}) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
            <p className="font-medium text-ink2">{label}</p>
            <p className="font-bold text-accent">
                {payload[0]!.value} signup{payload[0]!.value === 1 ? "" : "s"}
            </p>
        </div>
    );
}

function SignupsChart({ data }: { data: AdminStats["signupsLast7Days"] }) {
    const { dark, accentColor } = useChartTheme();
    const n = dark ? NEUTRALS.dark : NEUTRALS.light;
    const chartData = data.map((d) => ({
        ...d,
        label: dayjs(d.date).format("MMM D"),
    }));

    return (
        <OverviewCard title="Signups — last 7 days" bodyClassName="p-5">
            <div className="h-56 w-full">
                <ResponsiveContainer>
                    <LineChart
                        data={chartData}
                        margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke={n.line} />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: n.muted }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: n.muted }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip content={<SignupsTooltip />} />
                        <Line
                            type="monotone"
                            dataKey="count"
                            stroke={accentColor}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{
                                r: 4,
                                fill: accentColor,
                                strokeWidth: 0,
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </OverviewCard>
    );
}

function StatusDonut({ stats }: { stats: AdminStats }) {
    const { dark } = useChartTheme();
    const n = dark ? NEUTRALS.dark : NEUTRALS.light;
    const colors = STATUS_COLORS[dark ? "dark" : "light"];

    const entries: { status: AccountStatus; label: string; value: number }[] =
        [
            {
                status: "ACTIVE",
                label: "Active",
                value: stats.usersByStatus.ACTIVE,
            },
            {
                status: "PENDING",
                label: "Pending",
                value: stats.usersByStatus.PENDING,
            },
            {
                status: "SUSPENDED",
                label: "Suspended",
                value: stats.usersByStatus.SUSPENDED,
            },
        ];
    const shown = entries.filter((e) => e.value > 0);

    return (
        <OverviewCard title="Accounts by status" bodyClassName="p-4">
            <div className="flex flex-col items-center">
                <div className="relative">
                    <PieChart width={180} height={180}>
                        <Pie
                            data={shown.length ? shown : [{ value: 1 }]}
                            cx={90}
                            cy={90}
                            innerRadius={58}
                            outerRadius={80}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke={n.surface}
                            strokeWidth={2}
                        >
                            {shown.length ? (
                                shown.map((e) => (
                                    <Cell
                                        key={e.status}
                                        fill={colors[e.status]}
                                    />
                                ))
                            ) : (
                                <Cell fill={n.surface2} />
                            )}
                        </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display text-3xl text-ink">
                            {stats.totalUsers}
                        </span>
                        <span className="text-xs text-muted">users</span>
                    </div>
                </div>

                <ul className="mt-2 w-full space-y-1.5 px-2">
                    {entries.map((e) => (
                        <li
                            key={e.status}
                            className="flex items-center gap-2 text-sm"
                        >
                            <span
                                className="inline-block h-3 w-3 rounded-full"
                                style={{ background: colors[e.status] }}
                            />
                            <span className="text-ink2">{e.label}</span>
                            <span className="ml-auto font-semibold tabular-nums text-ink">
                                {e.value}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </OverviewCard>
    );
}

// Small adapter so both charts read the theme the same way DailyLineChart does.
function useChartTheme() {
    const { dark, accent } = useBloom();
    return { dark, accentColor: ACCENTS[accent].accent };
}

export default function AdminOverviewPage() {
    const {
        data: stats,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["admin", "stats"],
        queryFn: fetchAdminStats,
        retry: false,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
            </div>
        );
    }

    if (isError || !stats) {
        return (
            <div className="rounded-bloom border border-red-300 bg-red-500/10 px-6 py-10 text-center">
                <p className="text-sm font-medium text-red-500">
                    Could not load admin stats.
                </p>
            </div>
        );
    }

    const signupsThisWeek = stats.signupsLast7Days.reduce(
        (sum, d) => sum + d.count,
        0,
    );

    return (
        <div className="space-y-6">
            <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">
                    Admin
                </p>
                <h1 className="font-display text-4xl tracking-tight text-ink">
                    Overview
                </h1>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Pending approvals"
                    value={stats.usersByStatus.PENDING}
                    sub="waiting for you"
                    href="/admin/users?status=PENDING"
                    warn={stats.usersByStatus.PENDING > 0}
                />
                <StatCard
                    label="Active users"
                    value={stats.usersByStatus.ACTIVE}
                    sub={`of ${stats.totalUsers} accounts`}
                />
                <StatCard
                    label="Signups this week"
                    value={signupsThisWeek}
                    sub="last 7 days"
                />
                <StatCard
                    label="Active today"
                    value={stats.activeUsersToday}
                    sub={`${stats.logsToday} check-in${stats.logsToday === 1 ? "" : "s"} · ${stats.totalHabits} habits total`}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="lg:col-span-3">
                    <SignupsChart data={stats.signupsLast7Days} />
                </div>
                <StatusDonut stats={stats} />
            </div>
        </div>
    );
}
