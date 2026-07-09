import { useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useBloom, useTheme } from "../../theme/ThemeProvider";
import { ACCENTS, AccentKey } from "../../theme/tokens";
import { useAuth } from "../../api/AuthProvider";
import { useMe, useHabits, useUploadAvatar } from "../../api/hooks";
import { useOnline } from "../../offline/hooks";
import {
    requestPermission,
    syncReminders,
    useReminderPrefs,
} from "../../notifications";
import {
    setEnabled,
    setOverride,
    setQuietHours,
    toggleHabitTime,
} from "../../notifications/store";
import {
    PRESET_TIMES,
    TOD_DEFAULT_TIME,
    effectiveReminder,
} from "../../notifications/types";
import type { Tod } from "../../lib/types";
import { Card, Toggle } from "../../components/primitives";
import Icon from "../../components/Icon";

const TODS: Tod[] = ["morning", "afternoon", "evening", "anytime"];
const asTod = (t: string): Tod => (TODS.includes(t as Tod) ? (t as Tod) : "anytime");

/** "08:00" → "8:00 AM" for display. */
function fmtTime(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function SettingsScreen() {
    const th = useTheme();
    const bloom = useBloom();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { signOut } = useAuth();
    const { data: me } = useMe();
    const uploadAvatar = useUploadAvatar();
    const online = useOnline();

    async function pickAvatar() {
        if (uploadAvatar.isPending) return;
        // Avatar upload is a server-only action (multipart, no offline queue) —
        // block it while offline rather than fail silently.
        if (!online) {
            Alert.alert(
                "You're offline",
                "Changing your profile picture needs a connection. Try again once you're back online.",
            );
            return;
        }
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert(
                "Photo access needed",
                "Allow photo library access to change your profile picture.",
            );
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        uploadAvatar.mutate(
            {
                uri: asset.uri,
                mimeType: asset.mimeType,
                fileName: asset.fileName ?? undefined,
            },
            {
                onError: () =>
                    Alert.alert(
                        "Upload failed",
                        "Could not update your picture. Please try again.",
                    ),
            },
        );
    }

    const now = useMemo(() => new Date(), []);
    const { data: habits = [] } = useHabits(
        now.getFullYear(),
        now.getMonth() + 1,
    );

    const reminders = useReminderPrefs();
    const enabledCount = reminders.enabled
        ? habits.filter(
              (h) => effectiveReminder(h.id, asTod(h.tod), reminders).enabled,
          ).length
        : 0;

    async function toggleReminders() {
        if (reminders.enabled) {
            await setEnabled(false);
            void syncReminders();
            return;
        }
        // Ask for permission only here — an explicit opt-in, never on launch.
        const ok = await requestPermission();
        if (!ok) {
            Alert.alert(
                "Notifications are off",
                "Turn on notifications for HabitFlow in your device settings to get habit reminders.",
                [
                    { text: "Not now", style: "cancel" },
                    {
                        text: "Open settings",
                        onPress: () => Linking.openSettings(),
                    },
                ],
            );
            return;
        }
        await setEnabled(true);
        void syncReminders();
    }

    const Section = ({
        title,
        children,
    }: {
        title: string;
        children: React.ReactNode;
    }) => (
        <View style={{ marginBottom: 22 }}>
            <Text
                style={{
                    fontSize: 11,
                    color: th.muted,
                    fontFamily: th.sansBold,
                    letterSpacing: 0.8,
                    paddingHorizontal: th.d.pad,
                    marginBottom: 8,
                }}
            >
                {title}
            </Text>
            <Card pad={0} style={{ marginHorizontal: 14, overflow: "hidden" }}>
                {children}
            </Card>
        </View>
    );

    const Row = ({
        icon,
        label,
        hint,
        right,
        first,
        onPress,
    }: {
        icon?: string;
        label: string;
        hint?: string;
        right?: React.ReactNode;
        first?: boolean;
        onPress?: () => void;
    }) => (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderTopWidth: first ? 0 : 1.5,
                borderTopColor: th.bg,
            }}
        >
            {icon && (
                <View
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: th.surface2,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Icon
                        name={icon}
                        size={16}
                        stroke={th.ink2}
                        strokeWidth={1.7}
                    />
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontSize: 14.5,
                        color: th.ink,
                        fontFamily: th.sans,
                    }}
                >
                    {label}
                </Text>
                {hint && (
                    <Text
                        style={{ fontSize: 12, color: th.muted, marginTop: 2 }}
                    >
                        {hint}
                    </Text>
                )}
            </View>
            {right}
        </Pressable>
    );

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 120,
                }}
                showsVerticalScrollIndicator={false}
            >
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 36 * th.d.font,
                        color: th.ink,
                        paddingHorizontal: th.d.pad,
                        marginBottom: 22,
                    }}
                >
                    Settings
                </Text>

                {/* profile card */}
                <View
                    style={{
                        marginHorizontal: 14,
                        marginBottom: 24,
                        backgroundColor: th.accent,
                        borderRadius: 22,
                        padding: 20,
                        overflow: "hidden",
                    }}
                >
                    <View
                        style={{
                            position: "absolute",
                            top: -20,
                            right: -20,
                            width: 110,
                            height: 110,
                            borderRadius: 55,
                            backgroundColor: th.sun,
                            opacity: 0.4,
                        }}
                    />
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 14,
                        }}
                    >
                        <Pressable
                            onPress={pickAvatar}
                            disabled={uploadAvatar.isPending}
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: "#fff",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                            }}
                        >
                            {me?.avatarUrl ? (
                                <Image
                                    source={{ uri: me.avatarUrl }}
                                    style={{ width: 56, height: 56 }}
                                />
                            ) : (
                                <Text
                                    style={{
                                        fontFamily: th.display,
                                        fontSize: 22,
                                        color: th.deep,
                                    }}
                                >
                                    {me?.name?.[0]?.toUpperCase() ?? "?"}
                                </Text>
                            )}
                            {uploadAvatar.isPending && (
                                <View
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: "rgba(0,0,0,0.35)",
                                    }}
                                >
                                    <ActivityIndicator color="#fff" />
                                </View>
                            )}
                            <View
                                style={{
                                    position: "absolute",
                                    right: 0,
                                    bottom: 0,
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    backgroundColor: th.deep,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderWidth: 1.5,
                                    borderColor: "#fff",
                                }}
                            >
                                <Icon
                                    name="sparkle"
                                    size={10}
                                    stroke="#fff"
                                    strokeWidth={2}
                                />
                            </View>
                        </Pressable>
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontFamily: th.sansBold,
                                    color: "#fff",
                                }}
                            >
                                {me?.name ?? "Your account"}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12,
                                    color: "rgba(255,255,255,0.95)",
                                    marginTop: 3,
                                }}
                            >
                                {me?.email ?? ""}
                            </Text>
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 8,
                                    marginTop: 8,
                                }}
                            >
                                <View
                                    style={{
                                        backgroundColor:
                                            "rgba(255,255,255,0.25)",
                                        paddingVertical: 3,
                                        paddingHorizontal: 8,
                                        borderRadius: 8,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontFamily: th.sansBold,
                                            color: "#fff",
                                        }}
                                    >
                                        {habits.length} HABITS
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                <Section title="APPEARANCE">
                    <Row
                        first
                        icon="moon"
                        label="Dark mode"
                        hint={bloom.dark ? "On" : "Off"}
                        right={
                            <Toggle
                                on={bloom.dark}
                                onPress={() => bloom.setDark(!bloom.dark)}
                            />
                        }
                    />
                    <Row
                        icon="sparkle"
                        label="Accent color"
                        right={
                            <View style={{ flexDirection: "row", gap: 6 }}>
                                {(Object.keys(ACCENTS) as AccentKey[]).map(
                                    (k) => (
                                        <Pressable
                                            key={k}
                                            onPress={() => bloom.setAccent(k)}
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 11,
                                                backgroundColor:
                                                    ACCENTS[k].accent,
                                                borderWidth:
                                                    bloom.accent === k
                                                        ? 2.5
                                                        : 0,
                                                borderColor: th.ink,
                                            }}
                                        />
                                    ),
                                )}
                            </View>
                        }
                    />
                    <Row
                        icon="grid3"
                        label="Density"
                        hint={
                            bloom.density === "cozy"
                                ? "Cozy · larger targets"
                                : "Compact"
                        }
                        right={
                            <Pressable
                                onPress={() =>
                                    bloom.setDensity(
                                        bloom.density === "cozy"
                                            ? "compact"
                                            : "cozy",
                                    )
                                }
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: th.accent,
                                        fontFamily: th.sansBold,
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {bloom.density}
                                </Text>
                            </Pressable>
                        }
                    />
                    <Row
                        icon="list"
                        label="Today layout"
                        hint={
                            bloom.layout === "garden"
                                ? "Garden of plants"
                                : "Simple list"
                        }
                        right={
                            <Pressable
                                onPress={() =>
                                    bloom.setLayout(
                                        bloom.layout === "garden"
                                            ? "list"
                                            : "garden",
                                    )
                                }
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: th.accent,
                                        fontFamily: th.sansBold,
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {bloom.layout}
                                </Text>
                            </Pressable>
                        }
                    />
                </Section>

                <Section title="REMINDERS">
                    <Row
                        first
                        icon="bell"
                        label="Habit reminders"
                        hint={
                            reminders.enabled
                                ? `On · ${enabledCount} habit${enabledCount === 1 ? "" : "s"}`
                                : "Off · get nudged for what's still pending"
                        }
                        right={
                            <Toggle
                                on={reminders.enabled}
                                onPress={toggleReminders}
                            />
                        }
                    />
                    {reminders.enabled && (
                        <Row
                            icon="moonStars"
                            label="Quiet hours"
                            hint="10:00 PM – 7:00 AM silenced"
                            right={
                                <Toggle
                                    on={reminders.quietHours}
                                    onPress={() => {
                                        void setQuietHours(
                                            !reminders.quietHours,
                                        ).then(syncReminders);
                                    }}
                                />
                            }
                        />
                    )}
                    {reminders.enabled && habits.length === 0 && (
                        <Row
                            icon="sprout"
                            label="No habits yet"
                            hint="Add a habit to set a reminder"
                        />
                    )}
                    {reminders.enabled &&
                        habits.map((h) => {
                            const eff = effectiveReminder(
                                h.id,
                                asTod(h.tod),
                                reminders,
                            );
                            return (
                                <View
                                    key={h.id}
                                    style={{
                                        borderTopWidth: 1.5,
                                        borderTopColor: th.bg,
                                        paddingVertical: 12,
                                        paddingHorizontal: 16,
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        <Icon
                                            name={h.icon || "sprout"}
                                            size={18}
                                            stroke={th.ink2}
                                            strokeWidth={1.7}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={{
                                                    fontSize: 14.5,
                                                    color: th.ink,
                                                    fontFamily: th.sans,
                                                }}
                                                numberOfLines={1}
                                            >
                                                {h.name}
                                            </Text>
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    color: th.muted,
                                                    marginTop: 2,
                                                }}
                                            >
                                                {eff.enabled
                                                    ? eff.times
                                                          .map(fmtTime)
                                                          .join(" · ")
                                                    : "No reminder"}
                                            </Text>
                                        </View>
                                        <Toggle
                                            on={eff.enabled}
                                            onPress={() => {
                                                const patch = eff.enabled
                                                    ? { enabled: false }
                                                    : {
                                                          enabled: true,
                                                          times: [
                                                              TOD_DEFAULT_TIME[
                                                                  asTod(h.tod)
                                                              ],
                                                          ],
                                                      };
                                                void setOverride(
                                                    h.id,
                                                    patch,
                                                ).then(syncReminders);
                                            }}
                                        />
                                    </View>
                                    {eff.enabled && (
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                flexWrap: "wrap",
                                                gap: 6,
                                                marginTop: 10,
                                                marginLeft: 30,
                                            }}
                                        >
                                            {PRESET_TIMES.map((p) => {
                                                const on = eff.times.includes(
                                                    p.time,
                                                );
                                                return (
                                                    <Pressable
                                                        key={p.time}
                                                        onPress={() => {
                                                            void toggleHabitTime(
                                                                h.id,
                                                                p.time,
                                                                eff.times,
                                                            ).then(syncReminders);
                                                        }}
                                                        style={{
                                                            paddingVertical: 5,
                                                            paddingHorizontal: 11,
                                                            borderRadius: 14,
                                                            backgroundColor: on
                                                                ? th.accent
                                                                : th.surface2,
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                fontSize: 12,
                                                                fontFamily:
                                                                    th.sansBold,
                                                                color: on
                                                                    ? "#fff"
                                                                    : th.ink2,
                                                            }}
                                                        >
                                                            {p.label}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                </Section>

                <Section title="DATA">
                    <Row
                        first
                        icon="sparkle"
                        label="Replay onboarding"
                        right={
                            <Icon
                                name="chevronRight"
                                size={16}
                                stroke={th.muted}
                            />
                        }
                        onPress={() => router.push("/onboarding")}
                    />
                    <Row
                        icon="x"
                        label="Sign out"
                        right={
                            <Icon
                                name="chevronRight"
                                size={16}
                                stroke={th.muted}
                            />
                        }
                        onPress={signOut}
                    />
                </Section>

                <Text
                    style={{
                        textAlign: "center",
                        paddingHorizontal: 22,
                        paddingBottom: 28,
                        color: th.muted,
                        fontSize: 13,
                        fontFamily: th.display,
                        fontStyle: "italic",
                    }}
                >
                    Plant something today. ☿
                </Text>
            </ScrollView>
        </View>
    );
}
