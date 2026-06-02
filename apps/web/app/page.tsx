"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../src/lib/api";
import Navbar from "../components/layout/Navbar";
import Plant from "../components/bloom/Plant";
import BloomIcon from "../components/bloom/BloomIcon";

const features = [
    {
        icon: "check",
        title: "One-tap check-ins",
        desc: "Water a habit with a single tap and watch its plant stand tall for the day.",
    },
    {
        icon: "chart",
        title: "Progress charts",
        desc: "Daily and weekly trends show exactly where you're flourishing and where to tend.",
    },
    {
        icon: "list",
        title: "The story so far",
        desc: "A full month grid for every habit — spot patterns and celebrate consistency.",
    },
    {
        icon: "flame",
        title: "Streaks that grow",
        desc: "Every kept day stretches your streak, and your plant blooms a little more.",
    },
    {
        icon: "trophy",
        title: "Top growers",
        desc: "See your strongest habits ranked by completion to keep the momentum going.",
    },
    {
        icon: "sprout",
        title: "Seed packs",
        desc: "Start fast with curated habit packs, each with its own icon and routine.",
    },
];

const stats = [
    { value: "10k+", label: "Active gardeners" },
    { value: "98%", label: "Streak retention" },
    { value: "50+", label: "Habit seeds" },
    { value: "Free", label: "Forever plan" },
];

export default function Home() {
    const router = useRouter();

    const { data: me } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (me) router.replace("/dashboard");
    }, [me, router]);

    return (
        <div className="min-h-screen bg-bg">
            <Navbar variant="public" />

            {/* ── Hero ── */}
            <section className="relative overflow-hidden px-6 pb-20 pt-16 text-center">
                {/* sky → cream gradient wash */}
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            "linear-gradient(180deg, color-mix(in srgb, var(--bloom-sky) 30%, transparent) 0%, color-mix(in srgb, var(--bloom-accent) 12%, transparent) 45%, var(--bloom-bg) 100%)",
                    }}
                />
                {/* sun */}
                <div
                    className="pointer-events-none absolute -right-10 top-20 h-52 w-52 rounded-full opacity-60"
                    style={{ background: "var(--bloom-sun)" }}
                />

                <div className="relative mx-auto max-w-3xl">
                    {/* three plants at growing stages */}
                    <div className="mb-8 flex items-end justify-center gap-1">
                        <Plant streak={0} doneToday size={84} />
                        <Plant streak={5} doneToday size={124} />
                        <Plant streak={40} doneToday size={142} />
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink2">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        Free to use · No credit card required
                    </span>

                    <h1 className="mt-6 font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
                        Habits, but they
                        <br />
                        <span className="text-accent">grow with you.</span>
                    </h1>

                    <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink2">
                        Track what matters and watch your plants bloom as your
                        streaks stretch out. HabitFlow turns consistency into a
                        garden you&apos;ll want to tend.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-accent-deep active:scale-[0.98]"
                        >
                            Open your garden
                            <BloomIcon
                                name="arrowRight"
                                size={18}
                                stroke="#fff"
                                strokeWidth={2.2}
                            />
                        </Link>
                        <Link
                            href="/signup"
                            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-bold text-ink2 shadow-sm transition hover:bg-surface2 active:scale-[0.98]"
                        >
                            Plant your first seed
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="border-y border-line bg-surface2/40 px-6 py-10">
                <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
                    {stats.map(({ value, label }) => (
                        <div key={label} className="text-center">
                            <p className="font-display text-3xl text-accent">
                                {value}
                            </p>
                            <p className="mt-1 text-sm text-muted">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ── */}
            <section className="px-6 py-20">
                <div className="mx-auto max-w-5xl">
                    <div className="text-center">
                        <p className="text-xs font-bold uppercase tracking-widest text-accent">
                            Features
                        </p>
                        <h2 className="mt-2 font-display text-4xl text-ink">
                            Everything you need to keep growing
                        </h2>
                        <p className="mt-3 text-ink2">
                            Designed around the way real habit-building works.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map(({ icon, title, desc }) => (
                            <div
                                key={title}
                                className="rounded-bloom border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-(--bloom-card-shadow)"
                            >
                                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft/50 text-accent-deep">
                                    <BloomIcon name={icon} size={22} />
                                </div>
                                <h3 className="font-display text-lg text-ink">
                                    {title}
                                </h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-ink2">
                                    {desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="px-6 py-20">
                <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl bg-accent px-10 py-14 text-center shadow-xl">
                    <div
                        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40"
                        style={{ background: "var(--bloom-sun)" }}
                    />
                    <div className="relative">
                        <h2 className="font-display text-4xl text-white">
                            Plant something today.
                        </h2>
                        <p className="mx-auto mt-3 max-w-md text-white/90">
                            Join thousands of people growing better habits with
                            HabitFlow, one watered day at a time.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                            <Link
                                href="/signup"
                                className="rounded-full bg-white px-6 py-3 text-sm font-bold text-accent-deep shadow transition hover:bg-white/90 active:scale-[0.98]"
                            >
                                Start for free
                            </Link>
                            <Link
                                href="/login"
                                className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20 active:scale-[0.98]"
                            >
                                I already have a garden
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-line px-6 py-8 text-center font-display text-sm italic text-muted">
                Plant something today. ☿
            </footer>
        </div>
    );
}
