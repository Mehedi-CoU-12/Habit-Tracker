"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../src/lib/api";
import BloomIcon from "../../components/bloom/BloomIcon";
import TweaksMenu from "../../components/bloom/TweaksMenu";

/**
 * Shell for every /admin page: brand + section tabs + a way back to the
 * normal dashboard. The role check here is UX only — RolesGuard on the API
 * is the actual boundary (D6); a non-admin who bypasses this sees empty
 * 403'd queries, nothing more.
 */
export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const { data: me } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });
    // Signed-out visitors are redirected to /login by the api client's 401
    // handling; gated accounts land on /pending via the 403 handling.

    useEffect(() => {
        if (me && me.role !== "ADMIN") router.replace("/dashboard");
    }, [me, router]);

    if (!me || me.role !== "ADMIN") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-bg">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
            </div>
        );
    }

    const tabs = [
        {
            href: "/admin",
            label: "Overview",
            active: pathname === "/admin",
        },
        {
            href: "/admin/users",
            label: "Users",
            active: pathname.startsWith("/admin/users"),
        },
        {
            href: "/admin/releases",
            label: "Releases",
            active: pathname.startsWith("/admin/releases"),
        },
    ];

    return (
        <div className="min-h-screen bg-bg">
            <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-6">
                        <Link href="/admin" className="flex items-center gap-2.5">
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
                            <span className="rounded-full bg-accent-soft/60 px-2.5 py-0.5 text-xs font-bold text-accent-deep">
                                Admin
                            </span>
                        </Link>

                        <nav className="flex items-center gap-1">
                            {tabs.map((tab) => (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                                        tab.active
                                            ? "bg-accent text-white"
                                            : "text-ink2 hover:bg-surface2"
                                    }`}
                                >
                                    {tab.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-2">
                        <TweaksMenu />
                        <Link
                            href="/dashboard"
                            className="rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink2 transition hover:bg-surface2"
                        >
                            ← My garden
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        </div>
    );
}
