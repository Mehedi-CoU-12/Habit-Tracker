"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "../../src/lib/api";
import Plant from "../../components/bloom/Plant";
import BloomIcon from "../../components/bloom/BloomIcon";

/**
 * Waiting room for accounts that aren't ACTIVE yet. Polls /users/me (the one
 * endpoint gated accounts may call) so the moment the admin approves, the
 * same session unblocks and lands on the dashboard — no re-login needed.
 *
 * Deliberately NOT in the 401 allowlist (api.ts): if the token expires while
 * waiting, the standard 401 handling sends the user to /login, which is
 * exactly right — polling forever with a dead token helps nobody.
 */
export default function PendingPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const {
        data: me,
        refetch,
        isFetching,
    } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        refetchInterval: 30_000,
    });

    useEffect(() => {
        // No token → nothing to wait for.
        if (!localStorage.getItem("accessToken")) router.replace("/login");
    }, [router]);

    useEffect(() => {
        if (me?.status === "ACTIVE") router.replace("/dashboard");
    }, [me, router]);

    function handleSignOut() {
        localStorage.removeItem("accessToken");
        queryClient.removeQueries({ queryKey: ["me"] });
        router.push("/");
    }

    const suspended = me?.status === "SUSPENDED";

    return (
        <main className="flex min-h-screen items-center justify-center bg-bg p-6">
            <div className="w-full max-w-md rounded-bloom border border-line bg-surface p-8 text-center shadow-(--bloom-card-shadow)">
                <div className="mb-6 flex items-end justify-center gap-1">
                    <Plant streak={0} doneToday={false} size={72} />
                    <Plant streak={0} doneToday size={96} />
                    <Plant streak={0} doneToday={false} size={72} />
                </div>

                {suspended ? (
                    <>
                        <h1 className="font-display text-3xl text-ink">
                            Your account is suspended
                        </h1>
                        <p className="mt-3 text-sm leading-relaxed text-ink2">
                            Access to your garden has been paused. If you think
                            this is a mistake, contact the admin to get
                            reinstated.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="font-display text-3xl text-ink">
                            Your garden is almost ready
                        </h1>
                        <p className="mt-3 text-sm leading-relaxed text-ink2">
                            Your account is awaiting activation — contact the
                            admin to get approved. The moment you&apos;re in,
                            this page will take you straight to your dashboard.
                        </p>
                        <p className="mt-2 text-xs text-muted">
                            We re-check automatically every 30 seconds.
                        </p>
                    </>
                )}

                <div className="mt-8 flex flex-col items-center gap-3">
                    {!suspended && (
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <BloomIcon
                                name="arrowRight"
                                size={16}
                                stroke="#fff"
                                strokeWidth={2.2}
                            />
                            {isFetching ? "Checking…" : "Check again"}
                        </button>
                    )}
                    <button
                        onClick={handleSignOut}
                        className="w-full cursor-pointer rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink2 transition hover:bg-surface2 active:scale-[0.98]"
                    >
                        Sign out
                    </button>
                </div>

                {me?.email && (
                    <p className="mt-6 truncate text-xs text-muted">
                        Signed in as {me.email}
                    </p>
                )}
            </div>
        </main>
    );
}
