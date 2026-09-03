"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteAccount, fetchMe } from "../../../src/lib/api";
import BloomIcon from "../../../components/bloom/BloomIcon";

/** What a passwordless (Google) account types to prove it means it. */
const DELETE_WORD = "DELETE";

/**
 * Account deletion, on the web.
 *
 * Two halves on purpose. Signed in, it is the same irreversible confirmation
 * the app offers. Signed out, it is an explainer for requesting deletion by
 * email — that second half is what Google Play's Data Safety form requires: a
 * web-reachable URL where deletion can be requested *without installing the
 * app*. Pointing the form at the in-app flow gets the listing rejected.
 *
 * Deliberately reachable signed out: api.ts treats this path like the auth
 * pages, so an expired session lands on the explainer instead of /login.
 */
export default function DeleteAccountPage() {
    const queryClient = useQueryClient();
    const hasToken =
        typeof window !== "undefined" && !!localStorage.getItem("accessToken");

    const { data: me, isLoading } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        enabled: hasToken,
    });

    const [secret, setSecret] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    // Absent on a response cached before the field existed; assume a password
    // account, which asks for strictly more proof than the typed word.
    const hasPassword = me?.hasPassword !== false;
    const ready = hasPassword
        ? secret.length > 0
        : secret.trim().toUpperCase() === DELETE_WORD;

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        setError("");
        try {
            await deleteAccount(
                hasPassword ? { password: secret } : { confirmation: secret },
            );
            queryClient.clear();
            setDone(true);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not delete your account. Please try again.",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-bg p-6">
            <div className="w-full max-w-lg rounded-bloom border border-line bg-surface p-8 shadow-(--bloom-card-shadow)">
                <Link href="/" className="flex items-center gap-2.5">
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

                <h1 className="mt-6 font-display text-3xl text-ink">
                    Delete your account
                </h1>

                {done ? (
                    <Deleted />
                ) : isLoading ? (
                    <p className="mt-4 text-sm text-muted">Loading…</p>
                ) : me ? (
                    <SignedIn
                        email={me.email}
                        hasPassword={hasPassword}
                        secret={secret}
                        setSecret={(v) => {
                            setSecret(v);
                            if (error) setError("");
                        }}
                        error={error}
                        busy={busy}
                        ready={ready}
                        onSubmit={submit}
                    />
                ) : (
                    <SignedOut />
                )}
            </div>
        </main>
    );
}

function WhatGoes() {
    return (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/15">
            <p className="text-sm leading-relaxed text-ink2">
                Deleting your account permanently erases your profile, every
                habit, every check-in, every day note and every focus session,
                on all your devices. It cannot be undone and there is no grace
                period.
            </p>
        </div>
    );
}

function SignedIn({
    email,
    hasPassword,
    secret,
    setSecret,
    error,
    busy,
    ready,
    onSubmit,
}: {
    email: string;
    hasPassword: boolean;
    secret: string;
    setSecret: (v: string) => void;
    error: string;
    busy: boolean;
    ready: boolean;
    onSubmit: (e: React.FormEvent) => void;
}) {
    return (
        <>
            <p className="mt-2 truncate text-sm text-muted">
                Signed in as {email}
            </p>
            <WhatGoes />

            <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <label
                    htmlFor="delete-secret"
                    className="block text-sm text-ink2"
                >
                    {hasPassword
                        ? "Enter your password to confirm it is really you."
                        : `This account signs in with Google, so type ${DELETE_WORD} to confirm.`}
                </label>
                <input
                    id="delete-secret"
                    type={hasPassword ? "password" : "text"}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={hasPassword ? "Your password" : DELETE_WORD}
                    autoComplete={
                        hasPassword ? "current-password" : "off"
                    }
                    disabled={busy}
                    className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
                />
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={!ready || busy}
                    className="w-full cursor-pointer rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {busy ? "Deleting…" : "Delete my account forever"}
                </button>
                <Link
                    href="/dashboard"
                    className="block w-full rounded-full border border-line bg-surface px-4 py-2.5 text-center text-sm font-semibold text-ink2 transition hover:bg-surface2"
                >
                    Keep my account
                </Link>
            </form>
        </>
    );
}

/**
 * The half Play's Data Safety form points at: how to get your data erased
 * without installing anything. Two routes — sign in and do it yourself, or
 * ask by email — because a user who has lost their phone can only do the
 * second.
 */
function SignedOut() {
    const supportEmail =
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@habitflow.app";
    return (
        <>
            <p className="mt-2 text-sm text-ink2">
                You can delete your HabitFlow account and all of its data at any
                time, from the app or from here.
            </p>
            <WhatGoes />

            <h2 className="mt-6 text-sm font-bold text-ink">
                Delete it yourself
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink2">
                Sign in and come back to this page, or open the HabitFlow app
                and choose <strong>Settings → Delete account</strong>. The
                deletion happens immediately.
            </p>
            <Link
                href="/login"
                className="mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-deep active:scale-[0.98]"
            >
                Sign in
            </Link>

            <h2 className="mt-7 text-sm font-bold text-ink">
                Request it by email
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink2">
                If you can no longer sign in, email{" "}
                <a
                    href={`mailto:${supportEmail}?subject=Delete%20my%20HabitFlow%20account`}
                    className="font-semibold text-accent underline"
                >
                    {supportEmail}
                </a>{" "}
                from the address on your account, with the subject{" "}
                <em>Delete my HabitFlow account</em>. Requests are actioned
                within 30 days; you will get a confirmation once the data is
                gone.
            </p>

            <h2 className="mt-7 text-sm font-bold text-ink">What is kept</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink2">
                Nothing you created survives deletion. The only exception is a
                record of any payment you made, which is kept without your
                account link for accounting purposes — it retains the amount,
                the date and the email the payment was recorded against.
            </p>
        </>
    );
}

function Deleted() {
    return (
        <>
            <p className="mt-3 text-sm leading-relaxed text-ink2">
                Your account and everything in it have been deleted. Thanks for
                growing something with us.
            </p>
            <Link
                href="/"
                className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-deep active:scale-[0.98]"
            >
                Back to home
            </Link>
        </>
    );
}
