import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { hexA } from "../theme/tokens";
import Plant from "../components/Plant";
import Icon from "../components/Icon";
import { Toggle } from "../components/primitives";

const SEEDS = [
    { i: "moon", n: "Meditate" },
    { i: "droplet", n: "Drink water" },
    { i: "book", n: "Read" },
    { i: "dumbbell", n: "Move body" },
    { i: "pen", n: "Journal" },
    { i: "moonStars", n: "Sleep by 11" },
    { i: "leaf", n: "Eat greens" },
    { i: "sun", n: "Sunlight" },
];

function Dots({ active }: { active: number }) {
    const th = useTheme();
    return (
        <View
            style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
                marginBottom: 16,
            }}
        >
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={{
                        width: i === active ? 26 : 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: i === active ? th.accent : th.line,
                    }}
                />
            ))}
        </View>
    );
}

export default function Onboarding() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState(0);
    const [picked, setPicked] = useState<string[]>([
        "moon",
        "droplet",
        "book",
        "moonStars",
    ]);
    const toggle = (i: string) =>
        setPicked((p) =>
            p.includes(i) ? p.filter((x) => x !== i) : [...p, i],
        );

    const done = () => router.replace("/");

    const PrimaryButton = ({
        label,
        onPress,
        dark,
    }: {
        label: string;
        onPress: () => void;
        dark?: boolean;
    }) => (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: dark ? th.ink : th.accent,
                borderRadius: 28,
                paddingVertical: 16,
                paddingHorizontal: 20,
            }}
        >
            <Text
                style={{
                    fontFamily: th.sansBold,
                    fontSize: 16,
                    color: dark ? th.bg : "#fff",
                }}
            >
                {label}
            </Text>
            <View
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: dark
                        ? th.accent
                        : "rgba(255,255,255,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icon
                    name="arrowRight"
                    size={18}
                    stroke="#fff"
                    strokeWidth={2.2}
                />
            </View>
        </Pressable>
    );

    // ── STEP 0 — welcome ──
    if (step === 0) {
        return (
            <View style={{ flex: 1, backgroundColor: th.bg }}>
                <LinearGradient
                    colors={[
                        hexA(th.sky, th.dark ? 0.2 : 0.33),
                        hexA(th.accent, 0.12),
                        th.bg,
                    ]}
                    locations={[0, 0.5, 1]}
                    style={{ position: "absolute", inset: 0 }}
                />
                <View
                    style={{
                        position: "absolute",
                        top: 110,
                        right: -40,
                        width: 200,
                        height: 200,
                        borderRadius: 100,
                        backgroundColor: th.sun,
                        opacity: 0.6,
                    }}
                />
                <View
                    style={{
                        flex: 1,
                        paddingHorizontal: 30,
                        paddingTop: insets.top + 80,
                        paddingBottom: insets.bottom + 30,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            alignItems: "flex-end",
                            marginBottom: 20,
                        }}
                    >
                        <Plant streak={0} doneToday size={86} />
                        <Plant streak={5} doneToday size={128} />
                        <Plant streak={40} doneToday size={146} />
                    </View>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 44,
                            lineHeight: 46,
                            color: th.ink,
                            textAlign: "center",
                        }}
                    >
                        Habits, but they{"\n"}
                        <Text style={{ color: th.accent }}>grow with you.</Text>
                    </Text>
                    <Text
                        style={{
                            textAlign: "center",
                            marginTop: 18,
                            fontSize: 15.5,
                            lineHeight: 22,
                            color: th.ink2,
                            paddingHorizontal: 14,
                        }}
                    >
                        Track what matters. Watch your plants bloom as your
                        streaks stretch out.
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Dots active={0} />
                    <PrimaryButton
                        label="Get started"
                        onPress={() => setStep(1)}
                        dark
                    />
                </View>
            </View>
        );
    }

    // ── STEP 1 — pick seeds ──
    if (step === 1) {
        return (
            <View style={{ flex: 1, backgroundColor: th.bg }}>
                <ScrollView
                    contentContainerStyle={{
                        paddingTop: insets.top + 20,
                        paddingHorizontal: 26,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 12,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                        }}
                    >
                        STEP 2 OF 3
                    </Text>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 34,
                            lineHeight: 36,
                            color: th.ink,
                            marginTop: 8,
                        }}
                    >
                        What do you want to grow?
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: th.ink2,
                            lineHeight: 20,
                            marginTop: 8,
                            marginBottom: 20,
                        }}
                    >
                        Pick a few seeds to start. You can add more anytime.
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 10,
                        }}
                    >
                        {SEEDS.map((s) => {
                            const on = picked.includes(s.i);
                            return (
                                <Pressable
                                    key={s.i}
                                    onPress={() => toggle(s.i)}
                                    style={{
                                        width: "47.5%",
                                        padding: 16,
                                        borderRadius: 18,
                                        backgroundColor: th.surface,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.accent : th.line,
                                        gap: 10,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            backgroundColor: hexA(
                                                th.accent,
                                                0.18,
                                            ),
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Icon
                                            name={s.i}
                                            size={20}
                                            stroke={th.accent}
                                            strokeWidth={1.8}
                                        />
                                    </View>
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontFamily: th.sansBold,
                                            color: th.ink,
                                        }}
                                    >
                                        {s.n}
                                    </Text>
                                    {on && (
                                        <View
                                            style={{
                                                position: "absolute",
                                                top: 12,
                                                right: 12,
                                                width: 22,
                                                height: 22,
                                                borderRadius: 11,
                                                backgroundColor: th.accent,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Icon
                                                name="check"
                                                size={12}
                                                stroke="#fff"
                                                strokeWidth={2.6}
                                            />
                                        </View>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>
                <View
                    style={{
                        paddingHorizontal: 26,
                        paddingBottom: insets.bottom + 24,
                        paddingTop: 14,
                    }}
                >
                    <Dots active={1} />
                    <PrimaryButton
                        label={`Continue · ${picked.length} selected`}
                        onPress={() => setStep(2)}
                        dark
                    />
                </View>
            </View>
        );
    }

    // ── STEP 2 — routines ──
    const routines = [
        { i: "sun", n: "Morning routine", h: "Reminder at 7:00am", on: true },
        { i: "cloud", n: "Afternoon", h: "Off", on: false },
        { i: "moonStars", n: "Wind down", h: "Reminder at 9:30pm", on: true },
    ];
    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <LinearGradient
                colors={[hexA(th.accent, 0.18), th.bg]}
                locations={[0, 0.6]}
                style={{ position: "absolute", inset: 0 }}
            />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 20,
                    paddingHorizontal: 26,
                }}
            >
                <Text
                    style={{
                        fontSize: 12,
                        color: th.muted,
                        fontFamily: th.sansBold,
                        letterSpacing: 0.8,
                    }}
                >
                    STEP 3 OF 3
                </Text>
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 34,
                        lineHeight: 36,
                        color: th.ink,
                        marginTop: 8,
                    }}
                >
                    When does your day bloom?
                </Text>
                <Text
                    style={{
                        fontSize: 14,
                        color: th.ink2,
                        lineHeight: 20,
                        marginTop: 8,
                        marginBottom: 20,
                    }}
                >
                    We&apos;ll send a gentle nudge — never a pushy one.
                </Text>
                {routines.map((r, k) => (
                    <View
                        key={k}
                        style={{
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: r.on ? th.accent : th.line,
                            borderRadius: 22,
                            padding: 18,
                            marginBottom: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <View
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: r.on
                                        ? th.accentSoftBg
                                        : th.surface2,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Icon
                                    name={r.i}
                                    size={22}
                                    stroke={r.on ? th.accent : th.ink2}
                                    strokeWidth={1.8}
                                />
                            </View>
                            <View>
                                <Text
                                    style={{
                                        fontSize: 16,
                                        fontFamily: th.sansBold,
                                        color: th.ink,
                                    }}
                                >
                                    {r.n}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: th.muted,
                                        marginTop: 2,
                                    }}
                                >
                                    {r.h}
                                </Text>
                            </View>
                        </View>
                        <Toggle on={r.on} />
                    </View>
                ))}
            </ScrollView>
            <View
                style={{
                    paddingHorizontal: 26,
                    paddingBottom: insets.bottom + 24,
                    paddingTop: 14,
                }}
            >
                <Dots active={2} />
                <Pressable
                    onPress={done}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        backgroundColor: th.accent,
                        borderRadius: 28,
                        paddingVertical: 16,
                    }}
                >
                    <Text
                        style={{
                            fontFamily: th.sansBold,
                            fontSize: 15,
                            color: "#fff",
                        }}
                    >
                        Plant your garden
                    </Text>
                    <Icon
                        name="sparkle"
                        size={18}
                        stroke="#fff"
                        fill="#fff"
                        strokeWidth={1.2}
                    />
                </Pressable>
            </View>
        </View>
    );
}
