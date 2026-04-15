"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../src/lib/api";
import {
    IconEyeClosed,
    IconEyeOpen,
    IconGoogle,
    IconLogo,
} from "../../components/icons/Icon";

function PasswordStrengthBar({ password }: { password: string }) {
    const strength = (() => {
        if (password.length === 0) return 0;
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
    })();

    const labels = ["", "Weak", "Fair", "Good", "Strong"];
    const colors = [
        "",
        "bg-red-500",
        "bg-yellow-500",
        "bg-blue-500",
        "bg-green-500",
    ];
    const textColors = [
        "",
        "text-red-600",
        "text-yellow-600",
        "text-blue-600",
        "text-green-600",
    ];

    if (password.length === 0) return null;

    return (
        <div className="mt-2">
            <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? colors[strength] : "bg-gray-200"}`}
                    />
                ))}
            </div>
            <p className={`mt-1 text-xs font-medium ${textColors[strength]}`}>
                {labels[strength]}
            </p>
        </div>
    );
}

export default function SignupPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [password, setPassword] = useState("");
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
        const name = formData.get("name") as string;
        const password = formData.get("password") as string;
        const confirmPassword = formData.get("confirmPassword") as string;

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/auth/signup`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password }),
                },
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? "Signup failed");
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
                        <IconLogo />
                        <span className="text-white font-bold text-xl">
                            HabitFlow
                        </span>
                    </div>
                </div>

                <div>
                    <h2 className="text-white text-4xl font-bold leading-tight">
                        Start building better habits today.
                    </h2>
                    <p className="mt-4 text-indigo-200 text-base leading-relaxed">
                        Join thousands of people who use HabitFlow to build
                        lasting routines, track their progress, and achieve
                        their goals.
                    </p>

                    <div className="mt-10 grid grid-cols-2 gap-4">
                        {[
                            { stat: "10k+", label: "Active users" },
                            { stat: "98%", label: "Streak retention" },
                            { stat: "50+", label: "Habit templates" },
                            { stat: "Free", label: "Forever plan" },
                        ].map(({ stat, label }) => (
                            <div
                                key={label}
                                className="rounded-xl bg-white/10 p-4"
                            >
                                <p className="text-white text-2xl font-bold">
                                    {stat}
                                </p>
                                <p className="text-indigo-200 text-sm mt-0.5">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-indigo-300 text-xs">
                    © 2026 HabitFlow. All rights reserved.
                </p>
            </div>

            {/* Right form panel */}
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="flex min-h-full flex-col items-center justify-center p-6 py-10 sm:p-12">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2 mb-8">
                        <IconLogo />
                        <span className="text-gray-900 font-bold text-xl">
                            HabitFlow
                        </span>
                    </div>

                    <div className="w-full max-w-sm">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Create your account
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            Start tracking habits — it&apos;s free forever.
                        </p>

                        <form
                            onSubmit={handleSubmit}
                            className="mt-8 space-y-5"
                        >
                            <div>
                                <label
                                    htmlFor="name"
                                    className="block text-sm font-medium text-gray-700 mb-1.5"
                                >
                                    Full name
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required
                                    autoComplete="name"
                                    placeholder="Jane Doe"
                                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

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
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 mb-1.5"
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        required
                                        autoComplete="new-password"
                                        placeholder="At least 8 characters"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword((v) => !v)
                                        }
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
                                <PasswordStrengthBar password={password} />
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 mb-1.5"
                                >
                                    Confirm password
                                </label>
                                <div className="relative">
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirm ? "text" : "password"}
                                        required
                                        autoComplete="new-password"
                                        placeholder="Re-enter your password"
                                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowConfirm((v) => !v)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                        aria-label={
                                            showConfirm
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                    >
                                        {showConfirm ? (
                                            <IconEyeOpen />
                                        ) : (
                                            <IconEyeClosed />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-start gap-1">
                                <input
                                    id="remember"
                                    type="checkbox"
                                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 accent-indigo-600"
                                />
                                <label
                                    htmlFor="remember"
                                    className="text-sm text-gray-600"
                                ></label>
                                <label
                                    htmlFor="terms"
                                    className="text-sm text-gray-600"
                                >
                                    I agree to the{" "}
                                    <Link
                                        href="#"
                                        className="font-medium text-indigo-600 hover:text-indigo-700 transition"
                                    >
                                        Terms of Service
                                    </Link>{" "}
                                    and{" "}
                                    <Link
                                        href="#"
                                        className="font-medium text-indigo-600 hover:text-indigo-700 transition"
                                    >
                                        Privacy Policy
                                    </Link>
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
                                {loading
                                    ? "Creating account…"
                                    : "Create account"}
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
                            Already have an account?{" "}
                            <Link
                                href="/login"
                                className="font-semibold text-indigo-600 hover:text-indigo-700 transition"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
