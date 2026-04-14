"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../src/lib/api";
import {
    IconCheckTiny,
    IconEyeClosed,
    IconEyeOpen,
    IconGoogle,
    IconLogo,
} from "../../components/icons/Icon";

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    function validateEmail(value: string): string {
        if (!value) return "Email is required";
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
        if (me) router.replace("/dashboard");
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
            localStorage.setItem("accessToken", data.accessToken);
            router.push("/dashboard");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex">
            {/* Left branding panel */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-800">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600">
                            <IconLogo />
                        </div>
                        <span className="text-white font-bold text-xl">
                            HabitFlow
                        </span>
                    </div>
                </div>

                <div>
                    <blockquote className="text-white text-3xl font-semibold leading-snug">
                        &ldquo;We are what we repeatedly do. Excellence, then,
                        is not an act, but a habit.&rdquo;
                    </blockquote>
                    <p className="mt-4 text-indigo-200 text-sm">— Aristotle</p>

                    <ul className="mt-10 space-y-3">
                        {[
                            "Track your daily habits effortlessly",
                            "Visualize progress with beautiful charts",
                            "Build streaks and stay motivated",
                        ].map((feature) => (
                            <li
                                key={feature}
                                className="flex items-center gap-3 text-indigo-100"
                            >
                                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                    <span className="text-white">
                                        <IconCheckTiny />
                                    </span>
                                </span>
                                <span className="text-sm">{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="text-indigo-300 text-xs">
                    © 2026 HabitFlow. All rights reserved.
                </p>
            </div>

            {/* Right form panel */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-white">
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <IconLogo />
                    </div>
                    <span className="text-gray-900 font-bold text-xl">
                        HabitFlow
                    </span>
                </div>

                <div className="w-full max-w-sm">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Welcome back
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Sign in to continue your streak.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-1.5"
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
                                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition ${
                                    emailError
                                        ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                        : "border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                }`}
                            />
                            {emailError && (
                                <p className="mt-1.5 text-xs text-red-600">
                                    {emailError}
                                </p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Password
                                </label>
                                <Link
                                    href="#"
                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition"
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
                                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
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
                                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 accent-indigo-600"
                            />
                            <label
                                htmlFor="remember"
                                className="text-sm text-gray-600"
                            >
                                Remember me for 30 days
                            </label>
                        </div>

                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full cursor-pointer rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? "Signing in…" : "Sign in"}
                        </button>
                    </form>

                    <div className="mt-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-xs text-gray-400">or</span>
                        <div className="h-px flex-1 bg-gray-200" />
                    </div>

                    <a
                        href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
                        className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
                    >
                        <IconGoogle />
                        Continue with Google
                    </a>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/signup"
                            className="font-semibold text-indigo-600 hover:text-indigo-700 transition"
                        >
                            Create one free
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
