"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { fetchMe, fetchWeeklyReview } from "../../src/lib/api";
import BloomIcon from "../../components/bloom/BloomIcon";
import Plant from "../../components/bloom/Plant";
import { IconChevronLeftSmall } from "../../components/icons/Icon";

export default function ReviewPage() {
    const router = useRouter();
    const { data: me, isLoading: meLoading } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
    });
    const {
        data: r,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["weeklyReview"],
        queryFn: fetchWeeklyReview,
        retry: false,
        enabled: !!me,
    });

    if (!meLoading && !me) {
        router.replace("/login");
        return null;
    }

    const range = r
        ? `${dayjs(r.weekStart).format("MMM D")} – ${dayjs(r.weekEnd).format("MMM D")}`
        : "This week";

    return (
        <div className="min-h-screen bg-bg">
            <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2.5"
                    >
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent">
                            <BloomIcon
                                name="sprout"
                                size={20}
                                stroke="#fff"
                                strokeWidth={2}
                            />
                        </span>
                        <span className="font-display text-xl text-ink">
                            HabitFlow
                        </span>
                    </Link>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-1.5 text-xs font-medium text-ink2 transition hover:text-ink"
                    >
                        <IconChevronLeftSmall />
                        Back to dashboard
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-ink2">
                        {range}
                    </p>
                    <h1 className="mt-1 font-display text-4xl text-ink">
                        Your week
                    </h1>
                </div>

                {(isLoading || meLoading) && (
                    <div className="flex justify-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
                    </div>
                )}

                {isError && (
                    <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
                        Couldn&apos;t load your review. Try again in a moment.
                    </p>
                )}

                {r && r.due === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
                        <Plant streak={0} doneToday size={96} />
                        <p className="text-muted">
                            Nothing was due this week. Plant a habit and your
                            first review arrives on Sunday.
                        </p>
                    </div>
                )}

                {r && r.due > 0 && (
                    <>
                        <section className="relative overflow-hidden rounded-3xl bg-accent p-7 text-white">
                            <span className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-sun opacity-40" />
                            <p className="relative font-display text-6xl">
                                {r.rate}%
                            </p>
                            <p className="relative mt-1 font-bold text-white/90">
                                {r.bestWeek
                                    ? "Your best week yet 🌸"
                                    : `${r.done} of ${r.due} check-ins`}
                            </p>
                            {r.highlight && (
                                <p className="relative mt-3 text-sm">
                                    {r.highlight}
                                </p>
                            )}
                        </section>

                        <section className="grid grid-cols-3 gap-3">
                            {[
                                {
                                    v: r.perfectDays,
                                    l: "Perfect days",
                                    c: "text-green",
                                },
                                {
                                    v: r.milestones.length,
                                    l: "Milestones",
                                    c: "text-accent",
                                },
                                {
                                    v: r.freezesUsed,
                                    l: "Freezes used",
                                    c: "text-sky",
                                },
                            ].map((s) => (
                                <div
                                    key={s.l}
                                    className="rounded-2xl border border-line bg-surface p-4 text-center"
                                >
                                    <p
                                        className={`font-display text-3xl ${s.c}`}
                                    >
                                        {s.v}
                                    </p>
                                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                                        {s.l}
                                    </p>
                                </div>
                            ))}
                        </section>

                        <section className="divide-y divide-line rounded-2xl border border-line bg-surface">
                            {r.habits.map((h) => (
                                <div
                                    key={h.id}
                                    className="flex items-center gap-4 px-5 py-3.5"
                                >
                                    <BloomIcon
                                        name={h.icon}
                                        size={18}
                                        className="text-accent"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-bold text-ink">
                                            {h.name}
                                            {h.bestWeek ? " 🌸" : ""}
                                        </p>
                                        <div className="mt-1.5 h-1.5 rounded-full bg-surface2">
                                            <div
                                                className="h-1.5 rounded-full bg-green"
                                                style={{ width: `${h.rate}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="font-bold tabular-nums text-ink2">
                                        {h.done}/{h.due}
                                    </span>
                                </div>
                            ))}
                        </section>

                        {r.milestones.length > 0 && (
                            <section className="space-y-2">
                                {r.milestones.map((m) => (
                                    <p
                                        key={`${m.habitId}-${m.days}`}
                                        className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-3 text-ink"
                                    >
                                        <BloomIcon
                                            name="trophy"
                                            size={18}
                                            className="text-accent"
                                        />
                                        {m.name} reached a {m.days}-day streak
                                    </p>
                                ))}
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
