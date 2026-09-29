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
import { useWeeklyReview } from "../api/hooks";
import { monthShort } from "../lib/date";
import { Card, Pill, SkyWash } from "../components/primitives";
import Icon from "../components/Icon";

/** "2026-09-07" → "Sep 7". */
function short(iso: string): string {
    const [, m, d] = iso.split("-").map(Number);
    return `${monthShort[(m ?? 1) - 1]} ${d}`;
}

export default function ReviewScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { data: r, isLoading, isError, refetch } = useWeeklyReview();

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={260} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 48,
                    paddingHorizontal: th.d.pad,
                    gap: 16,
                }}
                showsVerticalScrollIndicator={false}
            >
                <Pressable
                    onPress={goBack}
                    accessibilityLabel="Back"
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: th.surface,
                        borderWidth: 1.5,
                        borderColor: th.line,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Icon name="chevronLeft" size={18} stroke={th.ink} />
                </Pressable>

                <View>
                    <Text
                        style={{
                            fontSize: 12,
                            color: th.ink2,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.5,
                        }}
                    >
                        {r
                            ? `${short(r.weekStart).toUpperCase()} – ${short(r.weekEnd).toUpperCase()}`
                            : "THIS WEEK"}
                    </Text>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 34 * th.d.font,
                            color: th.ink,
                            marginTop: 6,
                        }}
                    >
                        Your week
                    </Text>
                </View>

                {isLoading && <ActivityIndicator color={th.accent} />}

                {isError && !r && (
                    <Card style={{ alignItems: "center", gap: 10 }}>
                        <Text style={{ color: th.muted, textAlign: "center" }}>
                            Couldn&apos;t load your review. Check your
                            connection.
                        </Text>
                        <Pill label="Try again" onPress={() => refetch()} />
                    </Card>
                )}

                {r && r.due === 0 && (
                    <Card>
                        <Text style={{ color: th.muted, textAlign: "center" }}>
                            Nothing was due this week. Plant a habit and your
                            first review arrives on Sunday.
                        </Text>
                    </Card>
                )}

                {r && r.due > 0 && (
                    <>
                        <View
                            style={{
                                backgroundColor: th.accent,
                                borderRadius: th.d.radius,
                                padding: 22,
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: th.display,
                                    fontSize: 44,
                                    color: "#fff",
                                }}
                            >
                                {r.rate}%
                            </Text>
                            <Text
                                style={{
                                    color: "rgba(255,255,255,0.92)",
                                    fontFamily: th.sansBold,
                                    marginTop: 2,
                                }}
                            >
                                {r.bestWeek
                                    ? "Your best week yet 🌸"
                                    : `${r.done} of ${r.due} check-ins`}
                            </Text>
                            {r.highlight && (
                                <Text
                                    style={{
                                        color: "#fff",
                                        marginTop: 10,
                                        fontSize: 14,
                                    }}
                                >
                                    {r.highlight}
                                </Text>
                            )}
                        </View>

                        <View style={{ flexDirection: "row", gap: 8 }}>
                            {[
                                {
                                    v: r.perfectDays,
                                    l: "perfect days",
                                    c: th.green,
                                },
                                {
                                    v: r.milestones.length,
                                    l: "milestones",
                                    c: th.accent,
                                },
                                {
                                    v: r.freezesUsed,
                                    l: "freezes used",
                                    c: th.sky,
                                },
                            ].map((s) => (
                                <Card
                                    key={s.l}
                                    pad={14}
                                    style={{ flex: 1, alignItems: "center" }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: th.display,
                                            fontSize: 24,
                                            color: s.c,
                                        }}
                                    >
                                        {s.v}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 10.5,
                                            color: th.muted,
                                            fontFamily: th.sansBold,
                                            letterSpacing: 0.5,
                                            textTransform: "uppercase",
                                            marginTop: 4,
                                        }}
                                    >
                                        {s.l}
                                    </Text>
                                </Card>
                            ))}
                        </View>

                        <Card pad={6}>
                            {r.habits.map((h, i) => (
                                <Pressable
                                    key={h.id}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/habit/[id]",
                                            params: { id: h.id },
                                        })
                                    }
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: 12,
                                        borderBottomWidth:
                                            i === r.habits.length - 1 ? 0 : 1,
                                        borderBottomColor: th.line,
                                    }}
                                >
                                    <Icon
                                        name={h.icon}
                                        size={18}
                                        stroke={th.accent}
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            numberOfLines={1}
                                            style={{
                                                fontFamily: th.sansBold,
                                                color: th.ink,
                                            }}
                                        >
                                            {h.name}
                                            {h.bestWeek ? " 🌸" : ""}
                                        </Text>
                                        <View
                                            style={{
                                                height: 6,
                                                borderRadius: 3,
                                                backgroundColor: th.surface2,
                                                marginTop: 6,
                                                overflow: "hidden",
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: `${h.rate}%`,
                                                    height: "100%",
                                                    backgroundColor: th.green,
                                                }}
                                            />
                                        </View>
                                    </View>
                                    <Text
                                        style={{
                                            fontFamily: th.sansBold,
                                            color: th.ink2,
                                        }}
                                    >
                                        {h.done}/{h.due}
                                    </Text>
                                </Pressable>
                            ))}
                        </Card>

                        {r.milestones.map((m) => (
                            <Card
                                key={`${m.habitId}-${m.days}`}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                <Icon
                                    name="trophy"
                                    size={18}
                                    stroke={th.accent}
                                />
                                <Text style={{ color: th.ink, flex: 1 }}>
                                    {m.name} reached a {m.days}-day streak
                                </Text>
                            </Card>
                        ))}
                    </>
                )}
            </ScrollView>
        </View>
    );
}
