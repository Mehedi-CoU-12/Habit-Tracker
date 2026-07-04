"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "../../../src/lib/api";

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        // The API redirects with the token in the URL fragment so it never
        // reaches server/proxy logs. Query param kept as a fallback for one
        // release (older API deploys).
        const fromHash = new URLSearchParams(
            window.location.hash.slice(1),
        ).get("token");
        const fromQuery = new URLSearchParams(window.location.search).get(
            "token",
        );
        const token = fromHash ?? fromQuery;

        if (token) {
            localStorage.setItem("accessToken", token);
            // Scrub the token from the address bar and browser history.
            window.history.replaceState(null, "", window.location.pathname);
        }

        // Fall back to a token stored moments ago — makes the effect safe to
        // re-run (React StrictMode) after the URL has been scrubbed.
        const stored = token ?? localStorage.getItem("accessToken");
        if (!stored) {
            router.replace("/login?error=oauth_failed");
            return;
        }

        // The Google redirect carries no user object — ask /users/me (works
        // while PENDING via @AllowInactive) and route on the account status.
        fetchMe()
            .then((me) =>
                router.replace(
                    me.status === "ACTIVE" ? "/dashboard" : "/pending",
                ),
            )
            .catch(() => router.replace("/login?error=oauth_failed"));
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-bg">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
                <p className="text-sm text-ink2">Signing you in…</p>
            </div>
        </div>
    );
}
