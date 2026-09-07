"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { resetPassword } from "../../src/lib/api";
import { IconEyeClosed, IconEyeOpen } from "../../components/icons/Icon";
import Plant from "../../components/bloom/Plant";
import BloomIcon from "../../components/bloom/BloomIcon";

/** Mobile deep link — the scheme registered in apps/mobile/app.json. */
const APP_SCHEME = "habitflow://reset-password";

function Card({ children }: { children: React.ReactNode }) {
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
                {children}
            </div>
        </main>
    );
}

function ResetPasswordForm() {
    const router = useRouter();
    const token = useSearchParams().get("token") ?? "";

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    // The reset revoked every session (tokenVersion), so /login is the only
    // sensible destination — go there on its own if the button is ignored.
    useEffect(() => {
        if (!done) return;
        const t = setTimeout(() => router.replace("/login"), 4000);
        return () => clearTimeout(t);
    }, [done, router]);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (password.length > 50) {
            setError("Password must be at most 50 characters");
            return;
        }
        if (password !== confirm) {
            setError("The two passwords don't match");
            return;
        }

        setLoading(true);
        try {
            await resetPassword(token, password);
            setDone(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong. Please try again.",
            );
        } finally {
            setLoading(false);
        }
    }

    if (!token) {
        return (
            <Card>
                <h1 className="font-display text-2xl text-ink">
                    This link is incomplete
                </h1>
                <p className="mt-2 text-sm text-ink2">
                    Open the link from your reset email, or ask for a new one.
                </p>
                <Link
                    href="/forgot-password"
                    className="mt-6 inline-block w-full rounded-full bg-accent px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98]"
                >
                    Request a new link
                </Link>
            </Card>
        );
    }

    if (done) {
        return (
            <Card>
                <div className="text-center">
                    <div className="mb-4 flex items-end justify-center gap-1">
                        <Plant streak={12} doneToday size={92} />
                    </div>
                    <h1 className="font-display text-2xl text-ink">
                        Password changed
                    </h1>
                    <p className="mt-2 text-sm text-ink2">
                        For safety, every device that was signed in has been
                        signed out. Use your new password to come back.
                    </p>
                    <Link
                        href="/login"
                        className="mt-6 inline-block w-full rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98]"
                    >
                        Sign in
                    </Link>
                </div>
            </Card>
        );
    }

    const inputClass =
        "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 pr-10 text-sm text-ink placeholder-muted outline-none transition focus:border-accent";

    return (
        <Card>
            <h1 className="font-display text-2xl text-ink">
                Choose a new password
            </h1>
            <p className="mt-1 text-sm text-ink2">
                At least 8 characters. This link works once.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                    <label
                        htmlFor="password"
                        className="mb-1.5 block text-sm font-medium text-ink2"
                    >
                        New password
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            required
                            autoFocus
                            autoComplete="new-password"
                            placeholder="Enter a new password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError("");
                            }}
                            className={inputClass}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink2"
                            aria-label={
                                showPassword ? "Hide password" : "Show password"
                            }
                        >
                            {showPassword ? <IconEyeOpen /> : <IconEyeClosed />}
                        </button>
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="confirm"
                        className="mb-1.5 block text-sm font-medium text-ink2"
                    >
                        Confirm password
                    </label>
                    <input
                        id="confirm"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="new-password"
                        placeholder="Type it again"
                        value={confirm}
                        onChange={(e) => {
                            setConfirm(e.target.value);
                            setError("");
                        }}
                        className={inputClass}
                    />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full cursor-pointer rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Saving…" : "Set new password"}
                </button>
            </form>

            {/* Reset mail is often read on a phone: hand the same token to the
                app rather than making the user finish in a mobile browser. */}
            <div className="mt-6 border-t border-line pt-5">
                <a
                    href={`${APP_SCHEME}?token=${encodeURIComponent(token)}`}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface2 px-4 py-2.5 text-sm font-semibold text-ink2 transition hover:bg-surface active:scale-[0.98]"
                >
                    <BloomIcon
                        name="sprout"
                        size={16}
                        stroke="currentColor"
                        strokeWidth={2}
                    />
                    Open in the HabitFlow app
                </a>
                <p className="mt-2 text-center text-xs text-muted">
                    On a phone with the app installed.
                </p>
            </div>
        </Card>
    );
}

export default function ResetPasswordPage() {
    // useSearchParams needs a Suspense boundary in the app router.
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-bg">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
                </div>
            }
        >
            <ResetPasswordForm />
        </Suspense>
    );
}
