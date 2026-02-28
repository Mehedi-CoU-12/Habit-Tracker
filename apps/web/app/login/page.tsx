"use client";

import Link from "next/link";
import { useState } from "react";

function EyeIcon({ open }: { open: boolean }) {
    if (open) {
        return (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
        </svg>
    );
}

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
    }

    return (
        <main className="min-h-screen flex">
            {/* Left branding panel */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-white font-bold text-xl">HabitFlow</span>
                    </div>
                </div>

                <div>
                    <blockquote className="text-white text-3xl font-semibold leading-snug">
                        &ldquo;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&rdquo;
                    </blockquote>
                    <p className="mt-4 text-indigo-200 text-sm">— Aristotle</p>

                    <ul className="mt-10 space-y-3">
                        {[
                            "Track your daily habits effortlessly",
                            "Visualize progress with beautiful charts",
                            "Build streaks and stay motivated",
                        ].map((feature) => (
                            <li key={feature} className="flex items-center gap-3 text-indigo-100">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </span>
                                <span className="text-sm">{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="text-indigo-300 text-xs">© 2026 HabitFlow. All rights reserved.</p>
            </div>

            {/* Right form panel */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-white">
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <span className="text-gray-900 font-bold text-xl">HabitFlow</span>
                </div>

                <div className="w-full max-w-sm">
                    <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
                    <p className="mt-1 text-sm text-gray-500">Sign in to continue your streak.</p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <Link href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    placeholder="Enter your password"
                                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    <EyeIcon open={showPassword} />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="remember"
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 accent-indigo-600"
                            />
                            <label htmlFor="remember" className="text-sm text-gray-600">
                                Remember me for 30 days
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
                        >
                            Sign in
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" className="font-semibold text-indigo-600 hover:text-indigo-700 transition">
                            Create one free
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
