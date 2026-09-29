import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { MILESTONES } from "../lib/progress";
import Plant from "./Plant";

/** Name and line for each milestone. */
export const MILESTONE_COPY: Record<number, { title: string; line: string }> =
    {
        7: {
            title: "First bloom",
            line: "A week of showing up. Your plant has flowered.",
        },
        30: {
            title: "Full bloom",
            line: "A month strong. This is who you are now.",
        },
        100: {
            title: "Evergreen",
            line: "100 days. Few gardens ever grow this far.",
        },
    };

/** The three milestone badges, lit up to the longest streak reached. */
export function MilestoneBadges({ longest }: { longest: number }) {
    const th = useTheme();
    return (
        <View style={{ flexDirection: "row", gap: 8 }}>
            {MILESTONES.map((m) => {
                const earned = longest >= m;
                return (
                    <View
                        key={m}
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 10,
                            borderRadius: th.d.radius,
                            borderWidth: 1.5,
                            borderColor: earned ? th.accent : th.line,
                            backgroundColor: earned
                                ? th.accentSoftBg
                                : th.surface,
                            opacity: earned ? 1 : 0.55,
                        }}
                    >
                        <Plant streak={m} doneToday={earned} size={44} />
                        <Text
                            style={{
                                fontFamily: th.sansBold,
                                fontSize: 12,
                                color: earned ? th.ink : th.muted,
                                marginTop: 2,
                            }}
                        >
                            {m} days
                        </Text>
                        <Text style={{ fontSize: 10.5, color: th.muted }}>
                            {MILESTONE_COPY[m]!.title}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}
