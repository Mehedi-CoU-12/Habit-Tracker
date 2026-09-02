import { useMemo } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useDeleteHabit, useHabits, useUpdateHabit } from "../api/hooks";
import { monthShort } from "../lib/date";
import { isDaily, scheduleLabel } from "../lib/schedule";
import { SkyWash, Card } from "../components/primitives";
import Icon from "../components/Icon";

/**
 * Archived habits: the reversible half of retiring a habit. They keep every
 * log, so their history still counts in Stats — this screen only exists to
 * bring one back, or to finally delete it.
 */
export default function ArchivedScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { data: raw = [], isLoading } = useHabits(year, month);
    const update = useUpdateHabit(year, month);
    const del = useDeleteHabit(year, month);

    const archived = useMemo(
        () =>
            raw
                .filter((h) => h.archivedAt)
                .sort((a, b) =>
                    (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""),
                ),
        [raw],
    );

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    const confirmDelete = (id: string, name: string) =>
        Alert.alert("Delete habit", `Remove "${name}" and its history?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => del.mutate(id),
            },
        ]);

    /** "Archived 12 Sep" — the date is the only thing worth showing here. */
    const when = (iso: string | null | undefined) => {
        if (!iso) return "Archived";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "Archived";
        return `Archived ${d.getDate()} ${monthShort[d.getMonth()]}`;
    };

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={240} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ paddingHorizontal: th.d.pad }}>
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
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 32 * th.d.font,
                            color: th.ink,
                            marginTop: 12,
                        }}
                    >
                        Archived
                    </Text>
                    <Text
                        style={{ fontSize: 14, color: th.ink2, marginTop: 4 }}
                    >
                        Put down, not thrown away — their history still counts
                        in your stats.
                    </Text>
                </View>

                {!isLoading && archived.length === 0 && (
                    <Card
                        style={{
                            margin: th.d.pad,
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Icon
                            name="archive"
                            size={34}
                            stroke={th.muted}
                            strokeWidth={1.5}
                        />
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 19,
                                color: th.ink,
                            }}
                        >
                            Nothing archived
                        </Text>
                        <Text style={{ color: th.muted, textAlign: "center" }}>
                            Hold a habit on Today, or use the box icon on its
                            page, to archive it.
                        </Text>
                    </Card>
                )}

                {archived.length > 0 && (
                    <Card
                        pad={0}
                        style={{
                            marginHorizontal: 14,
                            marginTop: 20,
                            overflow: "hidden",
                        }}
                    >
                        {archived.map((h, i) => (
                            <View
                                key={h.id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                    paddingVertical: 13,
                                    paddingHorizontal: 14,
                                    borderTopWidth: i === 0 ? 0 : 1.5,
                                    borderTopColor: th.bg,
                                }}
                            >
                                <View
                                    style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 11,
                                        backgroundColor: th.surface2,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Icon
                                        name={h.icon || "sprout"}
                                        size={17}
                                        stroke={th.ink2}
                                        strokeWidth={1.7}
                                    />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text
                                        numberOfLines={1}
                                        style={{
                                            fontSize: 14.5,
                                            fontFamily: th.sansBold,
                                            color: th.ink,
                                        }}
                                    >
                                        {h.name}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 11.5,
                                            color: th.muted,
                                            marginTop: 2,
                                        }}
                                    >
                                        {[
                                            when(h.archivedAt),
                                            isDaily(h.daysOfWeek)
                                                ? null
                                                : scheduleLabel(h.daysOfWeek),
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </Text>
                                </View>

                                <Pressable
                                    onPress={() =>
                                        update.mutate({
                                            id: h.id,
                                            input: { archived: false },
                                        })
                                    }
                                    accessibilityLabel={`Restore ${h.name}`}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 6,
                                        paddingVertical: 8,
                                        paddingHorizontal: 12,
                                        borderRadius: 14,
                                        backgroundColor: th.accentSoftBg,
                                        borderWidth: 1.5,
                                        borderColor: th.accent,
                                    }}
                                >
                                    <Icon
                                        name="sprout"
                                        size={14}
                                        stroke={th.deep}
                                        strokeWidth={1.8}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 12.5,
                                            fontFamily: th.sansBold,
                                            color: th.deep,
                                        }}
                                    >
                                        Restore
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => confirmDelete(h.id, h.name)}
                                    accessibilityLabel={`Delete ${h.name}`}
                                    style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 17,
                                        backgroundColor: th.dangerSoft,
                                        borderWidth: 1.5,
                                        borderColor: th.danger,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Icon
                                        name="trash"
                                        size={15}
                                        stroke={th.danger}
                                        strokeWidth={1.8}
                                    />
                                </Pressable>
                            </View>
                        ))}
                    </Card>
                )}
            </ScrollView>
        </View>
    );
}
