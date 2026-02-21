import Link from "next/link";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
            <h1 className="mb-4 text-4xl font-bold">
                Welcome to Habit Tracker
            </h1>
            <p className="mb-6 text-lg text-gray-600">
                Track your habits and achieve your goals!
            </p>
            <Link
                href="/dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
                Go to Dashboard
            </Link>
        </div>
    );
}
