"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    IconChevronDownSmall,
    IconPlusSmall,
    IconSignOutSmall,
    IconTemplateList,
    IconUserSmall,
} from "../icons/Icon";
import BloomIcon from "../bloom/BloomIcon";
import TweaksMenu from "../bloom/TweaksMenu";

type Me = {
    name: string;
    email: string;
    avatarUrl?: string | null;
    role?: "USER" | "ADMIN";
};

type PublicProps = {
    variant: "public";
};

type DashboardProps = {
    variant: "dashboard";
    me?: Me;
    onAddHabit: () => void;
    onShowTemplates: () => void;
    onSignOut: () => void;
};

type NavbarProps = PublicProps | DashboardProps;

function Wordmark({ small, home }: { small?: boolean; home: string }) {
    return (
        <Link href={home} className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent">
                <BloomIcon
                    name="sprout"
                    size={20}
                    stroke="#fff"
                    strokeWidth={2}
                />
            </span>
            <span
                className={`font-display text-ink ${small ? "text-xl" : "text-2xl"}`}
            >
                HabitFlow
            </span>
        </Link>
    );
}

export default function Navbar(props: NavbarProps) {
    const [showUserMenu, setShowUserMenu] = useState(false);
    const isDashboard = props.variant === "dashboard";

    return (
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
            <div
                className={`mx-auto flex max-w-7xl items-center justify-between px-6 ${
                    isDashboard ? "py-3" : "py-4"
                }`}
            >
                {/* In-app the logo is a "home" affordance → dashboard. On the
                    public site it points at the marketing landing page. */}
                <Wordmark
                    small={isDashboard}
                    home={isDashboard ? "/dashboard" : "/"}
                />

                <div className="flex items-center gap-2">
                    {isDashboard ? (
                        <>
                            <Link
                                href="/focus"
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink2 transition hover:bg-surface2"
                            >
                                <BloomIcon name="sun" size={14} />
                                Focus
                            </Link>
                            <button
                                onClick={props.onShowTemplates}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink2 transition hover:bg-surface2"
                            >
                                <IconTemplateList />
                                Templates
                            </button>
                            <button
                                onClick={props.onAddHabit}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-white transition hover:bg-accent-deep"
                            >
                                <IconPlusSmall />
                                New habit
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="rounded-full px-4 py-2 text-sm font-medium text-ink2 transition hover:bg-surface2"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/signup"
                                className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-accent-deep active:scale-[0.98]"
                            >
                                Get started free
                            </Link>
                        </>
                    )}

                    {/* Theme tweaks — both variants */}
                    <TweaksMenu />

                    {/* User menu — dashboard only */}
                    {isDashboard && (
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu((v) => !v)}
                                className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-surface2"
                            >
                                {props.me?.avatarUrl ? (
                                    <Image
                                        src={props.me.avatarUrl}
                                        alt={props.me.name}
                                        width={28}
                                        height={28}
                                        className="h-7 w-7 rounded-full object-cover ring-2 ring-accent-soft"
                                    />
                                ) : (
                                    <div className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-bold text-white">
                                        {props.me?.name?.[0]?.toUpperCase() ??
                                            "?"}
                                    </div>
                                )}
                                <span className="hidden max-w-24 truncate text-xs font-semibold text-ink2 sm:block">
                                    {props.me?.name ?? ""}
                                </span>
                                <IconChevronDownSmall />
                            </button>

                            {showUserMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-2xl border border-line bg-surface py-1.5 shadow-(--bloom-card-shadow)">
                                        <div className="border-b border-line px-3 py-2">
                                            <p className="truncate text-xs font-bold text-ink">
                                                {props.me?.name}
                                            </p>
                                            <p className="truncate text-xs text-muted">
                                                {props.me?.email}
                                            </p>
                                        </div>
                                        <Link
                                            href="/profile"
                                            onClick={() =>
                                                setShowUserMenu(false)
                                            }
                                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-ink2 transition hover:bg-surface2"
                                        >
                                            <IconUserSmall />
                                            Profile &amp; settings
                                        </Link>
                                        {props.me?.role === "ADMIN" && (
                                            <Link
                                                href="/admin"
                                                onClick={() =>
                                                    setShowUserMenu(false)
                                                }
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-ink2 transition hover:bg-surface2"
                                            >
                                                <BloomIcon
                                                    name="chart"
                                                    size={14}
                                                />
                                                Admin dashboard
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => {
                                                setShowUserMenu(false);
                                                props.onSignOut();
                                            }}
                                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-red-500 transition hover:bg-red-500/10"
                                        >
                                            <IconSignOutSmall />
                                            Sign out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
