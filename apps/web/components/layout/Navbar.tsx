"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "../../provider/theme";
import {
    IconChevronDownSmall,
    IconLogo,
    IconMoon,
    IconPlusSmall,
    IconSignOutSmall,
    IconSun,
    IconTemplateList,
    IconUserSmall,
} from "../icons/Icon";

type Me = { name: string; email: string; avatarUrl?: string | null };

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

export default function Navbar(props: NavbarProps) {
    const { theme, toggle } = useTheme();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const isDashboard = props.variant === "dashboard";

    return (
        <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur">
            <div
                className={`mx-auto flex max-w-7xl items-center justify-between px-6 ${isDashboard ? "py-3" : "py-4"}`}
            >
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                        <IconLogo />
                    </div>
                    <span
                        className={`font-bold text-gray-900 dark:text-white ${isDashboard ? "text-sm" : "text-lg"}`}
                    >
                        HabitFlow
                    </span>
                </Link>

                {/* Right side */}
                <div className="flex items-center gap-2">
                    {isDashboard ? (
                        <>
                            <button
                                onClick={props.onShowTemplates}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                <IconTemplateList />
                                Templates
                            </button>
                            <button
                                onClick={props.onAddHabit}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                            >
                                <IconPlusSmall />
                                Add habit
                            </button>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                Log in
                            </Link>
                            <Link
                                href="/signup"
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
                            >
                                Get started free
                            </Link>
                        </>
                    )}

                    {/* Dark mode toggle — both variants */}
                    <button
                        onClick={toggle}
                        aria-label="Toggle dark mode"
                        className="cursor-pointer flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                        {theme === "dark" ? <IconSun /> : <IconMoon />}
                    </button>

                    {/* User menu — dashboard only */}
                    {isDashboard && (
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu((v) => !v)}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                {props.me?.avatarUrl ? (
                                    <Image
                                        src={props.me.avatarUrl}
                                        alt={props.me.name}
                                        width={28}
                                        height={28}
                                        className="h-7 w-7 rounded-full object-cover ring-2 ring-indigo-100"
                                    />
                                ) : (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                                        {props.me?.name?.[0]?.toUpperCase() ??
                                            "?"}
                                    </div>
                                )}
                                <span className="hidden sm:block text-xs font-medium text-gray-700 dark:text-gray-300 max-w-24 truncate">
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
                                    <div className="absolute right-0 z-20 mt-1.5 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1.5">
                                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                {props.me?.name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {props.me?.email}
                                            </p>
                                        </div>
                                        <Link
                                            href="/profile"
                                            onClick={() =>
                                                setShowUserMenu(false)
                                            }
                                            className="flex cursor-pointer items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                        >
                                            <IconUserSmall />
                                            Profile &amp; settings
                                        </Link>
                                        <button
                                            onClick={() => {
                                                setShowUserMenu(false);
                                                props.onSignOut();
                                            }}
                                            className="flex cursor-pointer items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
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
