import { useRef, useState } from "react";
import { Share, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useTheme } from "../theme/ThemeProvider";
import { useHabits } from "../api/hooks";
import { Pill, SkyWash, Sparkles } from "../components/primitives";
import { MILESTONE_COPY, MilestoneBadges } from "../components/Milestones";
import Plant from "../components/Plant";

export default function MilestoneScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id, days } = useLocalSearchParams<{ id: string; days: string }>();
    const now = new Date();
    const { data: habits = [] } = useHabits(
        now.getFullYear(),
        now.getMonth() + 1,
    );
    const name = habits.find((h) => h.id === id)?.name ?? "Your habit";
    const n = Number(days) || 7;
    const copy = MILESTONE_COPY[n] ?? MILESTONE_COPY[7]!;

    const card = useRef<View>(null);
    const [sharing, setSharing] = useState(false);

    const close = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    const share = async () => {
        const message = `${n}-day streak on ${name} 🌸 — growing it with HabitFlow.`;
        setSharing(true);
        try {
            if (card.current && (await Sharing.isAvailableAsync())) {
                const uri = await captureRef(card, {
                    format: "png",
                    quality: 1,
                });
                await Sharing.shareAsync(uri, {
                    mimeType: "image/png",
                    dialogTitle: message,
                });
            } else {
                await Share.share({ message });
            }
        } catch {
            await Share.share({ message }).catch(() => {});
        } finally {
            setSharing(false);
        }
    };

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: th.bg,
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 24,
                paddingHorizontal: th.d.pad,
                justifyContent: "space-between",
            }}
        >
            <SkyWash height={420} />

            <View
                ref={card}
                collapsable={false}
                style={{
                    alignItems: "center",
                    paddingVertical: 28,
                    paddingHorizontal: 20,
                    borderRadius: 28,
                    backgroundColor: th.surface,
                    borderWidth: 1.5,
                    borderColor: th.line,
                }}
            >
                <View>
                    <Plant streak={n} doneToday size={200} />
                    <Sparkles show />
                </View>
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 40 * th.d.font,
                        color: th.accent,
                        marginTop: 4,
                    }}
                >
                    {n}-day streak
                </Text>
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 22 * th.d.font,
                        color: th.ink,
                        marginTop: 4,
                        textAlign: "center",
                    }}
                >
                    {name}
                </Text>
                <Text
                    style={{
                        fontFamily: th.sansBold,
                        fontSize: 13,
                        color: th.muted,
                        marginTop: 10,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                    }}
                >
                    {copy.title} · HabitFlow
                </Text>
            </View>

            <View style={{ gap: 14 }}>
                <Text
                    style={{
                        color: th.ink2,
                        fontSize: 15,
                        textAlign: "center",
                    }}
                >
                    {copy.line}
                </Text>
                <MilestoneBadges longest={n} />
                <Pill
                    primary
                    icon="sparkle"
                    label={sharing ? "Preparing…" : "Share"}
                    onPress={sharing ? undefined : share}
                />
                <Pill label="Keep growing" onPress={close} />
            </View>
        </View>
    );
}
