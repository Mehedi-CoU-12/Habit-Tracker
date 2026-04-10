"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMe, updateProfile, uploadAvatar } from "../../src/lib/api";

export default function ProfilePage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: me, isLoading } = useQuery({
        queryKey: ["me"],
        queryFn: fetchMe,
        retry: false,
    });

    // Redirect if not logged in
    if (!isLoading && !me) {
        router.replace("/login");
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                            <svg
                                className="h-5 w-5 text-white"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                            HabitFlow
                        </span>
                    </Link>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition"
                    >
                        <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        Back to dashboard
                    </Link>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Profile &amp; Settings
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage your account information and password.
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <AvatarSection
                            me={me!}
                            queryClient={queryClient}
                            fileInputRef={fileInputRef}
                        />
                        <ProfileSection me={me!} queryClient={queryClient} />
                        <PasswordSection queryClient={queryClient} />
                        <DangerSection router={router} queryClient={queryClient} />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Avatar ───────────────────────────────────────────── */
function AvatarSection({
    me,
    queryClient,
    fileInputRef,
}: {
    me: Awaited<ReturnType<typeof fetchMe>>;
    queryClient: ReturnType<typeof useQueryClient>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState("");

    const mutation = useMutation({
        mutationFn: (file: File) => uploadAvatar(file),
        onSuccess: (updated) => {
            queryClient.setQueryData(["me"], updated);
            setPreview(null);
        },
        onError: () =>
            setError("Upload failed. Make sure Cloudinary is configured."),
    });

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setPreview(URL.createObjectURL(file));
        mutation.mutate(file);
    }

    const avatarSrc = preview ?? me.avatarUrl;

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Profile picture
            </h2>
            <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                    {avatarSrc ? (
                        <Image
                            src={avatarSrc}
                            alt={me.name}
                            width={72}
                            height={72}
                            className="h-18 w-18 rounded-full object-cover ring-2 ring-indigo-100"
                            unoptimized={!!preview}
                        />
                    ) : (
                        <div
                            className="h-18 w-18 flex items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white"
                            style={{ width: 72, height: 72 }}
                        >
                            {me.name[0]?.toUpperCase() ?? "?"}
                        </div>
                    )}
                    {mutation.isPending && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </div>
                    )}
                </div>

                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={mutation.isPending}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                        {mutation.isPending ? "Uploading…" : "Change photo"}
                    </button>
                    <p className="mt-1.5 text-xs text-gray-400">
                        JPG, PNG or WebP · max 5 MB
                    </p>
                    {error && (
                        <p className="mt-1 text-xs text-red-600">{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Name ─────────────────────────────────────────────── */
function ProfileSection({
    me,
    queryClient,
}: {
    me: Awaited<ReturnType<typeof fetchMe>>;
    queryClient: ReturnType<typeof useQueryClient>;
}) {
    const [name, setName] = useState(me.name);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const mutation = useMutation({
        mutationFn: () => updateProfile({ name }),
        onSuccess: (updated) => {
            queryClient.setQueryData(["me"], updated);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        },
        onError: () => setError("Failed to update name."),
    });

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Account info
            </h2>
            <div className="space-y-4 max-w-sm">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Full name
                    </label>
                    <input
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setSuccess(false);
                            setError("");
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email
                    </label>
                    <input
                        value={me.email}
                        disabled
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                        Email cannot be changed.
                    </p>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                {success && (
                    <p className="text-xs text-green-600">
                        Name updated successfully.
                    </p>
                )}
                <button
                    onClick={() => mutation.mutate()}
                    disabled={
                        mutation.isPending || name === me.name || !name.trim()
                    }
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mutation.isPending ? "Saving…" : "Save changes"}
                </button>
            </div>
        </div>
    );
}

/* ── Password ─────────────────────────────────────────── */
function PasswordSection({
    queryClient,
}: {
    queryClient: ReturnType<typeof useQueryClient>;
}) {
    const [form, setForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const mutation = useMutation({
        mutationFn: () =>
            updateProfile({
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["me"] });
            setForm({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        },
        onError: (err: Error) =>
            setError(err.message ?? "Failed to change password."),
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        if (form.newPassword !== form.confirmPassword) {
            setError("New passwords do not match.");
            return;
        }
        if (form.newPassword.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        mutation.mutate();
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Change password
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
                {(
                    [
                        "currentPassword",
                        "newPassword",
                        "confirmPassword",
                    ] as const
                ).map((field) => (
                    <div key={field}>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {field === "currentPassword"
                                ? "Current password"
                                : field === "newPassword"
                                  ? "New password"
                                  : "Confirm new password"}
                        </label>
                        <input
                            type="password"
                            value={form[field]}
                            onChange={(e) => {
                                setForm((f) => ({
                                    ...f,
                                    [field]: e.target.value,
                                }));
                                setError("");
                                setSuccess(false);
                            }}
                            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                ))}
                {error && <p className="text-xs text-red-600">{error}</p>}
                {success && (
                    <p className="text-xs text-green-600">
                        Password changed successfully.
                    </p>
                )}
                <button
                    type="submit"
                    disabled={
                        mutation.isPending ||
                        !form.currentPassword ||
                        !form.newPassword ||
                        !form.confirmPassword
                    }
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {mutation.isPending ? "Updating…" : "Update password"}
                </button>
            </form>
        </div>
    );
}

/* ── Sign out ─────────────────────────────────────────── */
function DangerSection({
    router,
    queryClient,
}: {
    router: ReturnType<typeof useRouter>;
    queryClient: ReturnType<typeof useQueryClient>;
}) {
    function handleSignOut() {
        localStorage.removeItem("accessToken");
        queryClient.removeQueries({ queryKey: ["me"] });
        router.push("/login");
    }

    return (
        <div className="rounded-xl border border-red-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">
                Sign out
            </h2>
            <p className="text-xs text-gray-500 mb-4">
                You will be returned to the login page.
            </p>
            <button
                onClick={handleSignOut}
                className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
                Sign out
            </button>
        </div>
    );
}
