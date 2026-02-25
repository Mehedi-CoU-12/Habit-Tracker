"use client";

import Link from "next/link";

export default function SignupPage() {
    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
                <h1 className="text-3xl font-bold text-gray-900">Create account</h1>
                <p className="mt-2 text-sm text-gray-600">
                    Start tracking your habits today.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label
                            htmlFor="name"
                            className="mb-1 block text-sm font-medium text-gray-700"
                        >
                            Full name
                        </label>
                        <input
                            id="name"
                            type="text"
                            required
                            placeholder="Jane Doe"
                            className="w-full rounded border border-gray-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="email"
                            className="mb-1 block text-sm font-medium text-gray-700"
                        >
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            placeholder="you@example.com"
                            className="w-full rounded border border-gray-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-1 block text-sm font-medium text-gray-700"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            minLength={8}
                            placeholder="At least 8 characters"
                            className="w-full rounded border border-gray-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
                    >
                        Sign up
                    </button>
                </form>

                <p className="mt-4 text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="font-medium text-blue-600 hover:text-blue-700"
                    >
                        Log in
                    </Link>
                </p>
            </div>
        </main>
    );
}
