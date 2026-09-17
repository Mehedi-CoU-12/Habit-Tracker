import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { hexA } from "../theme/tokens";
import { useCreateHabit } from "../api/hooks";
import { Tod } from "../lib/types";
import Icon from "../components/Icon";

/**
 * Post-signup setup: the one step that needs an account behind it.
 *
 * The pitch that used to lead this flow now runs before signup, in /welcome —
 * it's wasted on someone who has already joined. What's left is the part that
 * writes: picking starter habits, which this screen actually creates.
 */
const SEEDS: { i: string; n: string; tod: Tod }[] = [
    { i: "moon", n: "Meditate", tod: "morning" },
    { i: "droplet", n: "Drink water", tod: "anytime" },
    { i: "book", n: "Read", tod: "evening" },
    { i: "dumbbell", n: "Move body", tod: "morning" },
    { i: "pen", n: "Journal", tod: "evening" },
    { i: "moonStars", n: "Sleep by 11", tod: "evening" },
    { i: "leaf", n: "Eat greens", tod: "afternoon" },
    { i: "sun", n: "Sunlight", tod: "afternoon" },
];

/** Roughly five days a week — a target that survives a bad week. */
const STARTER_GOAL = 20;

export default function Onboarding() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const now = useMemo(() => new Date(), []);
    const create = useCreateHabit(now.getFullYear(), now.getMonth() + 1);

    const [picked, setPicked] = useState<string[]>([
        "moon",
        "droplet",
        "book",
        "moonStars",
    ]);
    const [planting, setPlanting] = useState(false);

    const toggle = (i: string) =>
        setPicked((p) =>
            p.includes(i) ? p.filter((x) => x !== i) : [...p, i],
        );

    /**
     * Plant each pick, then go home. The create hook is offline-first — it
     * writes the cache and queues the outbox — so this lands even on a signup
     * finished with no signal.
     */
    async function plant() {
        if (planting) return;
        setPlanting(true);
        for (const key of picked) {
            const seed = SEEDS.find((s) => s.i === key);
            if (!seed) continue;
            await create.mutateAsync({
                name: seed.n,
                goal: STARTER_GOAL,
                icon: seed.i,
                tod: seed.tod,
            });
        }
        router.replace("/");
    }

    const skip = () => router.replace("/");

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 20,
                    paddingHorizontal: 26,
                }}
                showsVerticalScrollIndicator={false}
            >
                <Text
                    style={{
                        fontSize: 12,
                        color: th.muted,
                        fontFamily: th.sansBold,
                        letterSpacing: 0.8,
                    }}
                >
                    ONE LAST THING
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
                    Pick a few seeds and we&apos;ll plant them for you. You can
                    rename, reschedule or remove any of them later.
                </Text>

                <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
                >
                    {SEEDS.map((s) => {
                        const on = picked.includes(s.i);
                        return (
                            <Pressable
                                key={s.i}
                                onPress={() => toggle(s.i)}
                                disabled={planting}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: on }}
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
                                        backgroundColor: hexA(th.accent, 0.18),
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
                <Pressable
                    onPress={picked.length > 0 && !planting ? plant : undefined}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: th.dark ? th.ink : th.accent,
                        borderRadius: 28,
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        opacity: picked.length > 0 && !planting ? 1 : 0.5,
                    }}
                >
                    <Text
                        style={{
                            fontFamily: th.sansBold,
                            fontSize: 16,
                            color: th.dark ? th.bg : "#fff",
                        }}
                    >
                        {planting
                            ? "Planting…"
                            : `Plant ${picked.length} habit${
                                  picked.length === 1 ? "" : "s"
                              }`}
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
                        {planting ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Icon
                                name="arrowRight"
                                size={18}
                                stroke="#fff"
                                strokeWidth={2.2}
                            />
                        )}
                    </View>
                </Pressable>

                <Pressable
                    onPress={planting ? undefined : skip}
                    style={{ paddingVertical: 14, marginTop: 4 }}
                >
                    <Text
                        style={{
                            textAlign: "center",
                            fontSize: 14.5,
                            color: th.muted,
                            fontFamily: th.sansBold,
                        }}
                    >
                        I&apos;ll start from scratch
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
