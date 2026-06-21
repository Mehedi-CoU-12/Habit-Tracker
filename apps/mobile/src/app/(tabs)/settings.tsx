import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBloom, useTheme } from "../../theme/ThemeProvider";
import { ACCENTS, AccentKey } from "../../theme/tokens";
import { useAuth } from "../../api/AuthProvider";
import { useMe, useHabits } from "../../api/hooks";
import { Card, Toggle } from "../../components/primitives";
import Icon from "../../components/Icon";

export default function SettingsScreen() {
    const th = useTheme();
    const bloom = useBloom();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { signOut } = useAuth();
    const { data: me } = useMe();

    const now = useMemo(() => new Date(), []);
    const { data: habits = [] } = useHabits(
        now.getFullYear(),
        now.getMonth() + 1,
    );

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
                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: "#fff",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: th.display,
                                    fontSize: 22,
                                    color: th.deep,
                                }}
                            >
                                {me?.name?.[0]?.toUpperCase() ?? "?"}
                            </Text>
                        </View>
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
                        label="Morning nudge"
                        hint="7:00am · daily"
                        right={<Toggle on />}
                    />
                    <Row
                        icon="moonStars"
                        label="Wind down"
                        hint="9:30pm · daily"
                        right={<Toggle on />}
                    />
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
