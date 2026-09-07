"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset } from "../../src/lib/api";
import Plant from "../../components/bloom/Plant";
import BloomIcon from "../../components/bloom/BloomIcon";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError("Enter a valid email address");
            return;
        }

        setLoading(true);
        try {
            await requestPasswordReset(trimmed);
            setSent(true);
        } catch (err) {
            // Only rate limiting and network failures land here — the API
            // never reports whether the address exists.
            const message =
                err instanceof Error ? err.message : "Something went wrong";
            setError(
                /too many requests/i.test(message)
                    ? "Too many attempts. Please wait a few minutes and try again."
                    : message,
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-bg p-6">
            <div className="w-full max-w-md rounded-bloom border border-line bg-surface p-8 shadow-(--bloom-card-shadow)">
                <div className="mb-6 flex items-center gap-2.5">
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
                </div>

                {sent ? (
                    <div className="text-center">
                        <div className="mb-4 flex items-end justify-center gap-1">
                            <Plant streak={3} doneToday size={84} />
                        </div>
                        <h1 className="font-display text-2xl text-ink">
                            Check your inbox
                        </h1>
                        <p className="mt-2 text-sm text-ink2">
                            If{" "}
                            <span className="font-semibold text-ink">
                                {email.trim()}
                            </span>{" "}
                            has a HabitFlow account, a reset link is on its way.
                            It expires in 30 minutes.
                        </p>
                        <p className="mt-4 text-xs text-muted">
                            Nothing arrived? Check your spam folder, or make
                            sure you signed up with this address. Accounts
                            created with Google get an email explaining that
                            instead.
                        </p>
                        <Link
                            href="/login"
                            className="mt-6 inline-block w-full rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98]"
                        >
                            Back to sign in
                        </Link>
                    </div>
                ) : (
                    <>
                        <h1 className="font-display text-2xl text-ink">
                            Forgot your password?
                        </h1>
                        <p className="mt-1 text-sm text-ink2">
                            Enter the email you signed up with and we&apos;ll
                            send a link to choose a new one.
                        </p>

                        <form
                            onSubmit={handleSubmit}
                            className="mt-6 space-y-5"
                        >
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
                                    autoFocus
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError("");
                                    }}
                                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-muted outline-none transition focus:border-accent"
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-500">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full cursor-pointer rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Sending…" : "Send reset link"}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-ink2">
                            Remembered it?{" "}
                            <Link
                                href="/login"
                                className="font-bold text-accent transition hover:text-accent-deep"
                            >
                                Sign in
                            </Link>
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}
