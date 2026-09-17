import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { useAdminReleases, useUpsertRelease } from "../../api/hooks";
import { AdminRelease, AppPlatform } from "../../api/endpoints";
import { monthShort } from "../../lib/date";
import { SkyWash, Card, Pill } from "../../components/primitives";
import AdminHeader from "../../components/admin/AdminHeader";

const PLATFORMS: { key: AppPlatform; label: string; hint: string }[] = [
    {
        key: "ANDROID",
        label: "Android",
        hint: "Direct .apk link for sideloaded builds, or the Play Store listing.",
    },
    { key: "IOS", label: "iOS", hint: "App Store listing URL." },
];

// Mirrors the API's UpsertReleaseDto, so bad input is caught before the round
// trip — same rule, stated once on each side.
const VERSION = /^\d+(\.\d+){0,3}$/;

type Form = { latest: string; minimum: string; url: string; notes: string };

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

function publishedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getDate()} ${monthShort[d.getMonth()]}, ${hh}:${mm}`;
}

function Field({
    label,
    hint,
    error,
    value,
    placeholder,
    multiline,
    onChange,
}: {
    label: string;
    hint?: string;
    error?: string;
    value: string;
    placeholder: string;
    multiline?: boolean;
    onChange: (t: string) => void;
}) {
    const th = useTheme();
    return (
        <View style={{ marginTop: 14 }}>
            <Text
                style={{
                    fontSize: 11,
                    fontFamily: th.sansBold,
                    color: th.muted,
                    letterSpacing: 0.6,
                }}
            >
                {label.toUpperCase()}
            </Text>
            <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={th.muted}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={multiline}
                style={{
                    backgroundColor: th.bg,
                    borderWidth: 1.5,
                    borderColor: error ? th.danger : th.line,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    marginTop: 7,
                    fontSize: 14.5,
                    color: th.ink,
                    fontFamily: th.sans,
                    minHeight: multiline ? 78 : undefined,
                    textAlignVertical: multiline ? "top" : "center",
                }}
            />
            {error ? (
                <Text
                    style={{
                        fontSize: 11.5,
                        color: th.danger,
                        marginTop: 5,
                        fontFamily: th.sansBold,
                    }}
                >
                    {error}
                </Text>
            ) : hint ? (
                <Text
                    style={{ fontSize: 11.5, color: th.muted, marginTop: 5 }}
                >
                    {hint}
                </Text>
            ) : null}
        </View>
    );
}

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
    const th = useTheme();
    const [form, setForm] = useState<Form>(() => toForm(release));
    const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>(
        {},
    );
    const save = useUpsertRelease();

    // Re-seed when the fetch lands, or after a publish. React Query's
    // structural sharing keeps `release` stable across refetches that return
    // identical data, so a poll won't wipe an in-progress edit.
    useEffect(() => {
        setForm(toForm(release));
        setErrors({});
    }, [release]);

    const saved = toForm(release);
    const dirty = (Object.keys(form) as (keyof Form)[]).some(
        (k) => form[k].trim() !== saved[k].trim(),
    );

    function submit() {
        const next: Partial<Record<keyof Form, string>> = {};
        if (!VERSION.test(form.latest.trim()))
            next.latest = "Use a dotted numeric version, e.g. 1.2.0";
        if (!VERSION.test(form.minimum.trim()))
            next.minimum = "Use a dotted numeric version, e.g. 1.0.0";
        if (!/^https?:\/\/\S+$/.test(form.url.trim()))
            next.url = "Must be an http(s) link";
        setErrors(next);
        if (Object.keys(next).length > 0) return;

        save.mutate(
            {
                platform,
                input: {
                    latest: form.latest.trim(),
                    minimum: form.minimum.trim(),
                    url: form.url.trim(),
                    ...(form.notes.trim()
                        ? { notes: form.notes.trim() }
                        : {}),
                },
            },
            {
                onSuccess: () =>
                    Alert.alert(
                        "Published",
                        `${label} release is live. Installed apps pick it up on their next launch.`,
                    ),
                onError: (err: unknown) =>
                    Alert.alert(
                        "Could not publish",
                        err instanceof Error
                            ? err.message
                            : "Please try again.",
                    ),
            },
        );
    }

    return (
        <Card>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                }}
            >
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 20 * th.d.font,
                        color: th.ink,
                    }}
                >
                    {label}
                </Text>
                <Text style={{ fontSize: 11.5, color: th.muted }}>
                    {release
                        ? `published ${publishedAt(release.updatedAt)}`
                        : "nothing published yet"}
                </Text>
            </View>

            <Field
                label="Latest version"
                hint="Shows a dismissible “update available” prompt."
                error={errors.latest}
                value={form.latest}
                placeholder="1.2.0"
                onChange={(t) => setForm({ ...form, latest: t })}
            />
            <Field
                label="Minimum supported"
                hint="Anything older is blocked until it updates."
                error={errors.minimum}
                value={form.minimum}
                placeholder="1.0.0"
                onChange={(t) => setForm({ ...form, minimum: t })}
            />
            <Field
                label="Download URL"
                hint={hint}
                error={errors.url}
                value={form.url}
                placeholder="https://…"
                onChange={(t) => setForm({ ...form, url: t })}
            />
            <Field
                label="Release notes"
                hint="Optional — shown inside the update prompt."
                value={form.notes}
                placeholder="• Heatmap now has week / month / year views"
                multiline
                onChange={(t) => setForm({ ...form, notes: t })}
            />

            <Pill
                primary
                label={save.isPending ? "Publishing…" : "Publish"}
                onPress={save.isPending || !dirty ? undefined : submit}
                style={{
                    marginTop: 18,
                    opacity: save.isPending || !dirty ? 0.5 : 1,
                }}
            />
        </Card>
    );
}

export default function AdminReleasesScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const { data: releases, isLoading } = useAdminReleases();

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={220} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 60,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <AdminHeader
                    title="App releases"
                    subtitle="Raise latest to nudge everyone on an older build. Raise minimum only when an old client would actually break — that locks those users out until they update."
                    back="/admin"
                />

                {isLoading ? (
                    <ActivityIndicator
                        color={th.accent}
                        style={{ marginTop: 50 }}
                    />
                ) : (
                    <View
                        style={{
                            paddingHorizontal: th.d.pad,
                            marginTop: 18,
                            gap: 16,
                        }}
                    >
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
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
