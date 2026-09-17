import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../api/AuthProvider";
import { hexA } from "../theme/tokens";
import { storage, KEYS } from "../lib/storage";
import Plant from "../components/Plant";
import Icon from "../components/Icon";

/**
 * The pitch, shown once before an account exists.
 *
 * Setup that writes to an account (picking starter habits) can only happen
 * after signup and lives in /onboarding. What belongs *here* is the part that
 * is wasted afterwards: the reason to sign up at all. The signup form is where
 * people who don't yet know what this is drop out.
 */
export default function Welcome() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { token } = useAuth();
    const [step, setStep] = useState(0);

    // Settings can replay this for someone already signed in — they have
    // nowhere to sign up to, so the way out is their own garden.
    const signedIn = !!token;

    /** Remember it's been seen, then hand over to wherever they belong. */
    const leave = (to: "/signup" | "/login" | "/") => {
        void storage.set(KEYS.onboarded, "1");
        router.replace(to);
    };

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
                    paddingTop: insets.top + 70,
                    paddingBottom: insets.bottom + 26,
                }}
            >
                {step === 0 ? <Pitch /> : <HowItWorks />}

                <View style={{ flex: 1 }} />

                <Dots active={step} />

                {step === 0 ? (
                    <PrimaryButton
                        label="Show me"
                        onPress={() => setStep(1)}
                    />
                ) : (
                    <PrimaryButton
                        label={
                            signedIn ? "Back to my garden" : "Create my garden"
                        }
                        onPress={() => leave(signedIn ? "/" : "/signup")}
                    />
                )}

                {signedIn ? (
                    <View style={{ height: 15, marginTop: 4 }} />
                ) : (
                    <Pressable
                        onPress={() => leave("/login")}
                        style={{ paddingVertical: 15, marginTop: 4 }}
                    >
                        <Text
                            style={{
                                textAlign: "center",
                                fontSize: 14.5,
                                color: th.ink2,
                                fontFamily: th.sansBold,
                            }}
                        >
                            I already have an account
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

function Pitch() {
    const th = useTheme();
    return (
        <>
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
                Track what matters. Watch your plants bloom as your streaks
                stretch out.
            </Text>
        </>
    );
}

const POINTS: { icon: string; title: string; body: string }[] = [
    {
        icon: "check",
        title: "One tap a day",
        body: "Check a habit off and its plant grows. That's the whole loop.",
    },
    {
        icon: "calendar",
        title: "Only on the days you chose",
        body: "Set a habit to weekdays or weekends and it only asks on those days. Rest is part of the schedule.",
    },
    {
        icon: "cloud",
        title: "Works with no signal",
        body: "Check in on a plane or in a basement. It syncs itself when you're back.",
    },
];

function HowItWorks() {
    const th = useTheme();
    return (
        <>
            <Text
                style={{
                    fontFamily: th.display,
                    fontSize: 36,
                    lineHeight: 38,
                    color: th.ink,
                }}
            >
                How it works
            </Text>
            <View style={{ marginTop: 26, gap: 20 }}>
                {POINTS.map((p) => (
                    <View
                        key={p.title}
                        style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 14,
                        }}
                    >
                        <View
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 14,
                                backgroundColor: th.accentSoftBg,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Icon
                                name={p.icon}
                                size={20}
                                stroke={th.accent}
                                strokeWidth={1.9}
                            />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontFamily: th.sansBold,
                                    color: th.ink,
                                }}
                            >
                                {p.title}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 14,
                                    lineHeight: 20,
                                    color: th.ink2,
                                    marginTop: 3,
                                }}
                            >
                                {p.body}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </>
    );
}

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
            {[0, 1].map((i) => (
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

function PrimaryButton({
    label,
    onPress,
}: {
    label: string;
    onPress: () => void;
}) {
    const th = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: th.dark ? th.ink : th.accent,
                borderRadius: 28,
                paddingVertical: 16,
                paddingHorizontal: 20,
            }}
        >
            <Text
                style={{
                    fontFamily: th.sansBold,
                    fontSize: 16,
                    color: th.dark ? th.bg : "#fff",
                }}
            >
                {label}
            </Text>
            <View
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: th.dark
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
}
