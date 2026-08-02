"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    AdminRelease,
    AppPlatform,
    fetchAdminReleases,
    upsertAdminRelease,
} from "../../../src/lib/api";
import { toast } from "../../../src/lib/toast";

const PLATFORMS: { key: AppPlatform; label: string; hint: string }[] = [
    {
        key: "ANDROID",
        label: "Android",
        hint: "Direct .apk link for sideloaded builds, or the Play Store listing.",
    },
    {
        key: "IOS",
        label: "iOS",
        hint: "App Store listing URL.",
    },
];

// Mirrors the API's UpsertReleaseDto so bad input is caught before the round
// trip — same rule, stated once on each side.
const VERSION = /^\d+(\.\d+){0,3}$/;

type Form = {
    latest: string;
    minimum: string;
    url: string;
    notes: string;
};

const EMPTY: Form = { latest: "", minimum: "", url: "", notes: "" };

function toForm(release: AdminRelease | undefined): Form {
    if (!release) return EMPTY;
    return {
        latest: release.latest,
        minimum: release.minimum,
        url: release.url,
        notes: release.notes ?? "",
    };
}

function Field({
    label,
    hint,
    error,
    children,
}: {
    label: string;
    hint?: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
                {label}
            </span>
            <div className="mt-1.5">{children}</div>
            {error ? (
                <span className="mt-1 block text-xs font-semibold text-red-500">
                    {error}
                </span>
            ) : hint ? (
                <span className="mt-1 block text-xs text-muted">{hint}</span>
            ) : null}
        </label>
    );
}

const inputClass =
    "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent";

function PlatformCard({
    platform,
    label,
    hint,
    release,
}: {
    platform: AppPlatform;
    label: string;
    hint: string;
    release: AdminRelease | undefined;
}) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<Form>(() => toForm(release));
    const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>(
        {},
    );

    // Re-seed when the fetch lands, or after a publish. React Query's
    // structural sharing keeps `release` referentially stable across refetches
    // that return identical data, so a poll won't wipe an in-progress edit.
    useEffect(() => {
        setForm(toForm(release));
        setErrors({});
    }, [release]);

    const save = useMutation({
        mutationFn: () =>
            upsertAdminRelease(platform, {
                latest: form.latest.trim(),
                minimum: form.minimum.trim(),
                url: form.url.trim(),
                ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
            }),
        onSuccess: () => {
            toast.success(`${label} release published`);
            void queryClient.invalidateQueries({ queryKey: ["adminReleases"] });
        },
        onError: (err: Error) =>
            toast.error(err.message || "Could not publish"),
    });

    const validate = (): boolean => {
        const next: Partial<Record<keyof Form, string>> = {};
        if (!VERSION.test(form.latest.trim()))
            next.latest = "Use a dotted numeric version, e.g. 1.2.0";
        if (!VERSION.test(form.minimum.trim()))
            next.minimum = "Use a dotted numeric version, e.g. 1.0.0";
        if (!/^https?:\/\/\S+$/.test(form.url.trim()))
            next.url = "Must be an http(s) link";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) save.mutate();
    };

    return (
        <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-line bg-surface p-5"
        >
            <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl text-ink">{label}</h2>
                {release ? (
                    <span className="text-xs text-muted">
                        published {dayjs(release.updatedAt).format("D MMM, HH:mm")}
                    </span>
                ) : (
                    <span className="text-xs font-semibold text-muted">
                        nothing published yet
                    </span>
                )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                    label="Latest version"
                    hint="Shows a dismissible “update available” prompt."
                    error={errors.latest}
                >
                    <input
                        className={inputClass}
                        value={form.latest}
                        placeholder="1.2.0"
                        onChange={(e) =>
                            setForm({ ...form, latest: e.target.value })
                        }
                    />
                </Field>

                <Field
                    label="Minimum supported"
                    hint="Anything older is blocked until it updates."
                    error={errors.minimum}
                >
                    <input
                        className={inputClass}
                        value={form.minimum}
                        placeholder="1.0.0"
                        onChange={(e) =>
                            setForm({ ...form, minimum: e.target.value })
                        }
                    />
                </Field>
            </div>

            <div className="mt-4">
                <Field label="Download URL" hint={hint} error={errors.url}>
                    <input
                        className={inputClass}
                        value={form.url}
                        placeholder="https://…"
                        onChange={(e) =>
                            setForm({ ...form, url: e.target.value })
                        }
                    />
                </Field>
            </div>

            <div className="mt-4">
                <Field
                    label="Release notes"
                    hint="Optional — shown inside the update prompt."
                >
                    <textarea
                        className={`${inputClass} min-h-21 resize-y`}
                        value={form.notes}
                        placeholder="• Heatmap now has week / month / year views&#10;• Offline check-ins fixed"
                        onChange={(e) =>
                            setForm({ ...form, notes: e.target.value })
                        }
                    />
                </Field>
            </div>

            <button
                type="submit"
                disabled={save.isPending}
                className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            >
                {save.isPending ? "Publishing…" : "Publish"}
            </button>
        </form>
    );
}

export default function AdminReleasesPage() {
    const { data: releases, isLoading } = useQuery({
        queryKey: ["adminReleases"],
        queryFn: fetchAdminReleases,
        retry: false,
    });

    return (
        <div>
            <h1 className="font-display text-3xl text-ink">App releases</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted">
                Installed apps check this on launch. Raise{" "}
                <strong className="text-ink2">latest</strong> to nudge everyone
                on an older build; raise{" "}
                <strong className="text-ink2">minimum supported</strong> only
                when an old client would actually break, since that locks those
                users out until they update.
            </p>

            {isLoading ? (
                <div className="mt-8 h-8 w-8 animate-spin rounded-full border-4 border-line border-t-accent" />
            ) : (
                <div className="mt-6 grid gap-5">
                    {PLATFORMS.map((p) => (
                        <PlatformCard
                            key={p.key}
                            platform={p.key}
                            label={p.label}
                            hint={p.hint}
                            release={releases?.find(
                                (r) => r.platform === p.key,
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
