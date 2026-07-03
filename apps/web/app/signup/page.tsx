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
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? colors[strength] : "bg-line"}`}
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

        if (!name || !email || !password || !confirmPassword) {
            setError("All fields are required");
            return;
        }

        if (name.length > 50) {
            setError("Name must be at most 50 characters");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        if (password.length > 50) {
            setError("Password must be at most 50 characters");
            return;
        }

        if (confirmPassword.length > 50) {
            setError("Confirm password must be at most 50 characters");
            return;
        }

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
                            streak={0}
                            doneToday
                            size={74}
                            flowerColor="#fff"
                        />
                        <Plant
                            streak={6}
                            doneToday
                            size={104}
                            flowerColor="#fff"
                        />
                        <Plant
                            streak={30}
                            doneToday
                            size={130}
                            flowerColor="#fff"
                        />
                    </div>
                    <h2 className="font-display text-4xl leading-tight text-white">
                        Start growing better habits today.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-white/85">
                        Join thousands of people who use HabitFlow to build
                        lasting routines and watch their garden bloom, one day
                        at a time.
                    </p>

                    <div className="mt-10 grid grid-cols-2 gap-4">
                        {[
                            { stat: "10k+", label: "Active gardeners" },
                            { stat: "98%", label: "Streak retention" },
                            { stat: "50+", label: "Habit seeds" },
                            { stat: "Free", label: "Forever plan" },
                        ].map(({ stat, label }) => (
                            <div
                                key={label}
                                className="rounded-2xl bg-white/15 p-4"
                            >
                                <p className="font-display text-2xl text-white">
                                    {stat}
                                </p>
                                <p className="mt-0.5 text-sm text-white/80">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="relative text-xs text-white/70">
                    © 2026 HabitFlow. All rights reserved.
                </p>
            </div>

            {/* Right form panel */}
            <div className="flex-1 overflow-y-auto bg-bg">
                <div className="flex min-h-full flex-col items-center justify-center p-6 py-10 sm:p-12">
                    {/* Mobile logo */}
                    <div className="mb-8 lg:hidden">
                        <Wordmark />
                    </div>

                    <div className="w-full max-w-sm">
                        <h1 className="font-display text-3xl text-ink">
                            Create your account
                        </h1>
                        <p className="mt-1 text-sm text-ink2">
                            Plant your first seed — it&apos;s free forever.
                        </p>

                        <form
                            onSubmit={handleSubmit}
                            className="mt-8 space-y-5"
                        >
                            <div>
                                <label
                                    htmlFor="name"
                                    className="mb-1.5 block text-sm font-medium text-ink2"
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
                                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                                />
                            </div>

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
                                <label
                                    htmlFor="password"
                                    className="mb-1.5 block text-sm font-medium text-ink2"
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
                                        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 pr-10 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword((v) => !v)
                                        }
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
                                <PasswordStrengthBar password={password} />
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="mb-1.5 block text-sm font-medium text-ink2"
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
                                        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 pr-10 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowConfirm((v) => !v)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink2"
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

                            <div className="flex items-start gap-2">
                                <input
                                    id="terms"
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-line accent-(--bloom-accent)"
                                />
                                <label
                                    htmlFor="terms"
                                    className="text-sm text-ink2"
                                >
                                    I agree to the{" "}
                                    <Link
                                        href="#"
                                        className="font-semibold text-accent transition hover:text-accent-deep"
                                    >
                                        Terms of Service
                                    </Link>{" "}
                                    and{" "}
                                    <Link
                                        href="#"
                                        className="font-semibold text-accent transition hover:text-accent-deep"
                                    >
                                        Privacy Policy
                                    </Link>
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
                                {loading
                                    ? "Creating account…"
                                    : "Create account"}
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
                            Already have an account?{" "}
                            <Link
                                href="/login"
                                className="font-bold text-accent transition hover:text-accent-deep"
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
