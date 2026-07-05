"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe, setTokens } from "../../src/lib/api";
import {
    IconCheckTiny,
    IconEyeClosed,
    IconEyeOpen,
    IconGoogle,
} from "../../components/icons/Icon";
import Plant from "../../components/bloom/Plant";
import BloomIcon from "../../components/bloom/BloomIcon";

function Wordmark({ onDark }: { onDark?: boolean }) {
    return (
        <div className="flex items-center gap-2.5">
            <span
                className={`grid h-9 w-9 place-items-center rounded-xl ${
                    onDark ? "bg-white/20" : "bg-accent"
                }`}
            >
                <BloomIcon
                    name="sprout"
                    size={20}
                    stroke="#fff"
                    strokeWidth={2}
                />
            </span>
            <span
                className={`font-display text-xl ${onDark ? "text-white" : "text-ink"}`}
            >
                HabitFlow
            </span>
        </div>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    function validateEmail(value: string): string {
        if (!value) return "Email is required";
        if (value.length > 50) return "Email must be at most 50 characters";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            return "Enter a valid email address";
        return "";
    }

    const { data: me } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (me)
            router.replace(me.status === "ACTIVE" ? "/dashboard" : "/pending");
    }, [me, router]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        const emailErr = validateEmail(email);
        if (emailErr) {
            setEmailError(emailErr);
            return;
        }

        const formData = new FormData(event.currentTarget);
        const password = formData.get("password") as string;

        if (!password) {
            setError("Password is required");
            return;
        }

        if (password.length > 50) {
            setError("Password must be at most 50 characters");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                },
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? "Login failed");
                return;
            }
            setTokens(data.accessToken, data.refreshToken);
            // PENDING/SUSPENDED accounts can log in but land on the waiting
            // screen instead of the dashboard (§6.1).
            router.push(
                data.user?.status === "ACTIVE" ? "/dashboard" : "/pending",
            );
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen bg-bg">
            {/* Left branding panel — accent garden */}
            <div className="relative hidden flex-col justify-between overflow-hidden bg-accent p-12 lg:flex lg:w-1/2">
                <div
                    className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-40"
                    style={{ background: "var(--bloom-sun)" }}
                />
                <div className="relative">
                    <Wordmark onDark />
                </div>

                <div className="relative">
                    <div className="mb-8 flex items-end gap-1">
                        <Plant
                            streak={2}
                            doneToday
                            size={78}
                            flowerColor="#fff"
                        />
                        <Plant
                            streak={12}
                            doneToday
                            size={104}
                            flowerColor="#fff"
                        />
                        <Plant
                            streak={40}
                            doneToday
                            size={132}
                            flowerColor="#fff"
                        />
                    </div>
                    <blockquote className="font-display text-3xl leading-snug text-white">
                        &ldquo;We are what we repeatedly do. Excellence, then,
                        is not an act, but a habit.&rdquo;
                    </blockquote>
                    <p className="mt-4 text-sm text-white/80">— Aristotle</p>

                    <ul className="mt-10 space-y-3">
                        {[
                            "Track your daily habits effortlessly",
                            "Watch your plants bloom with every streak",
                            "Visualize progress with beautiful charts",
                        ].map((feature) => (
                            <li
                                key={feature}
                                className="flex items-center gap-3 text-white/90"
                            >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25">
                                    <span className="text-white">
                                        <IconCheckTiny />
                                    </span>
                                </span>
                                <span className="text-sm">{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-xs text-white/70">
                    © 2026 HabitFlow. All rights reserved.
                </p>
            </div>

            {/* Right form panel */}
            <div className="flex flex-1 flex-col items-center justify-center bg-bg p-6 sm:p-12">
                {/* Mobile logo */}
                <div className="mb-8 lg:hidden">
                    <Wordmark />
                </div>

                <div className="w-full max-w-sm">
                    <h1 className="font-display text-3xl text-ink">
                        Welcome back
                    </h1>
                    <p className="mt-1 text-sm text-ink2">
                        Sign in to keep your garden growing.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-1.5 block text-sm font-medium text-ink2"
                            >
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (emailError)
                                        setEmailError(
                                            validateEmail(e.target.value),
                                        );
                                }}
                                onBlur={() =>
                                    setEmailError(validateEmail(email))
                                }
                                className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-muted outline-none transition ${
                                    emailError
                                        ? "border-red-400 focus:border-red-500"
                                        : "border-line focus:border-accent"
                                }`}
                            />
                            {emailError && (
                                <p className="mt-1.5 text-xs text-red-500">
                                    {emailError}
                                </p>
                            )}
                        </div>

                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-ink2"
                                >
                                    Password
                                </label>
                                <Link
                                    href="#"
                                    className="text-xs font-semibold text-accent transition hover:text-accent-deep"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 pr-10 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink2"
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                >
                                    {showPassword ? (
                                        <IconEyeOpen />
                                    ) : (
                                        <IconEyeClosed />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="remember"
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer rounded border-line accent-(--bloom-accent)"
                            />
                            <label
                                htmlFor="remember"
                                className="text-sm text-ink2"
                            >
                                Remember me for 30 days
                            </label>
                        </div>

                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full cursor-pointer rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading ? "Signing in…" : "Sign in"}
                        </button>
                    </form>

                    <div className="mt-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-line" />
                        <span className="text-xs text-muted">or</span>
                        <div className="h-px flex-1 bg-line" />
                    </div>

                    <a
                        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
                        className="mt-4 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink2 shadow-sm transition hover:bg-surface2 active:scale-[0.98]"
                    >
                        <IconGoogle />
                        Continue with Google
                    </a>

                    <p className="mt-6 text-center text-sm text-ink2">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/signup"
                            className="font-bold text-accent transition hover:text-accent-deep"
                        >
                            Create one free
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
