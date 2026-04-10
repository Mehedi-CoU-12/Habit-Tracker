"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../src/lib/api";
import {
    IconArrowRight,
    IconBarChart,
    IconBars3,
    IconCheckCircle,
    IconClock,
    IconLogo,
    IconStar,
    IconTrophy,
} from "../components/icons/Icon";

const features = [
    {
        icon: <IconCheckCircle />,
        title: "Daily Check-ins",
        desc: "Mark habits as done with one tap. Build a consistent daily routine that sticks.",
    },
    {
        icon: <IconBarChart />,
        title: "Progress Charts",
        desc: "Visualize daily and weekly trends. See exactly where you're excelling and where to improve.",
    },
    {
        icon: <IconBars3 />,
        title: "Habit Grid",
        desc: "A full 31-day calendar grid for each habit. Spot patterns and celebrate consistency.",
    },
    {
        icon: <IconTrophy />,
        title: "Weekly Overview",
        desc: "Aggregated weekly stats show goal vs completion at a glance, every single week.",
    },
    {
        icon: <IconStar />,
        title: "Top Habits Ranking",
        desc: "See your top-performing habits ranked by completion rate to stay motivated.",
    },
    {
        icon: <IconClock />,
        title: "Monthly Goals",
        desc: "Set custom monthly targets per habit. Track your goal vs actual completion every day.",
    },
];

const stats = [
    { value: "10k+", label: "Active users" },
    { value: "98%", label: "Streak retention" },
    { value: "50+", label: "Habit templates" },
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

    if (me) {
        router.replace("/dashboard");
        return null;
    }

    return (
        <div className="min-h-screen bg-white">
            {/* ── Navbar ── */}
            <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                            <IconLogo />
                        </div>
                        <span className="text-lg font-bold text-gray-900">
                            HabitFlow
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/login"
                            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                        >
                            Log in
                        </Link>
                        <Link
                            href="/signup"
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
                        >
                            Get started free
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="relative overflow-hidden px-6 pb-20 pt-20 text-center">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-100 opacity-60 blur-3xl" />
                    <div className="absolute -right-32 top-0 h-96 w-96 rounded-full bg-violet-100 opacity-60 blur-3xl" />
                </div>

                <div className="relative mx-auto max-w-3xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        Free to use · No credit card required
                    </span>

                    <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
                        Build habits that{" "}
                        <span className="bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                            actually stick
                        </span>
                    </h1>

                    <p className="mt-5 text-lg leading-relaxed text-gray-500">
                        HabitFlow helps you track daily habits, visualize
                        progress with beautiful charts, and stay accountable —
                        one day at a time.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 active:scale-[0.98]"
                        >
                            Open Dashboard
                            <IconArrowRight />
                        </Link>
                        <Link
                            href="/signup"
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
                        >
                            Create free account
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="border-y border-gray-100 bg-gray-50 px-6 py-10">
                <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
                    {stats.map(({ value, label }) => (
                        <div key={label} className="text-center">
                            <p className="text-3xl font-extrabold text-indigo-600">
                                {value}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                {label}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ── */}
            <section className="px-6 py-20">
                <div className="mx-auto max-w-5xl">
                    <div className="text-center">
                        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
                            Features
                        </p>
                        <h2 className="mt-2 text-3xl font-bold text-gray-900">
                            Everything you need to stay on track
                        </h2>
                        <p className="mt-3 text-gray-500">
                            Designed around the way real habit-building works.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map(({ icon, title, desc }) => (
                            <div
                                key={title}
                                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                    {icon}
                                </div>
                                <h3 className="font-semibold text-gray-900">
                                    {title}
                                </h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                                    {desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="px-6 py-20">
                <div className="mx-auto max-w-2xl rounded-3xl bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-700 px-10 py-14 text-center shadow-xl">
                    <h2 className="text-3xl font-bold text-white">
                        Ready to build better habits?
                    </h2>
                    <p className="mt-3 text-indigo-200">
                        Join thousands of people who track their habits with
                        HabitFlow every day.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href="/signup"
                            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow transition hover:bg-indigo-50 active:scale-[0.98]"
                        >
                            Start for free
                        </Link>
                        <Link
                            href="/dashboard"
                            className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-[0.98]"
                        >
                            View demo
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-gray-100 px-6 py-8 text-center text-sm text-gray-400">
                © 2026 HabitFlow. Built with Next.js &amp; Tailwind CSS.
            </footer>
        </div>
    );
}
