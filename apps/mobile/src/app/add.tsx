import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useCreateHabit, useHabits, useUpdateHabit } from "../api/hooks";
import { Tod } from "../lib/types";
import Plant from "../components/Plant";
import Icon from "../components/Icon";
import { Pill } from "../components/primitives";

const ICONS = [
    "leaf",
    "sun",
    "droplet",
    "book",
    "dumbbell",
    "coffee",
    "music",
    "pen",
    "moon",
    "cloud",
    "flame",
    "sprout",
];

const WHEN: { l: string; i: string; v: Tod }[] = [
    { l: "Morning", i: "sun", v: "morning" },
    { l: "Noon", i: "cloud", v: "afternoon" },
    { l: "Evening", i: "moonStars", v: "evening" },
    { l: "Anytime", i: "sparkle", v: "anytime" },
];

export default function AddScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEdit = !!id;

    const now = useMemo(() => new Date(), []);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const create = useCreateHabit(year, month);
    const update = useUpdateHabit(year, month);
    const { data: habits = [] } = useHabits(year, month);
    const editing = id ? habits.find((h) => h.id === id) : undefined;
    const pending = isEdit ? update.isPending : create.isPending;

    const [name, setName] = useState("");
    const [verb, setVerb] = useState("");
    const [icon, setIcon] = useState("sprout");
    const [tod, setTod] = useState<Tod>("morning");
    const [goal, setGoal] = useState(20);

    // Pre-fill the form once the habit being edited is available from cache.
    const hydrated = useRef(false);
    useEffect(() => {
        if (isEdit && editing && !hydrated.current) {
            hydrated.current = true;
            setName(editing.name);
            setVerb(editing.verb ?? "");
            setIcon(editing.icon);
            setTod(editing.tod as Tod);
            setGoal(editing.goal);
        }
    }, [isEdit, editing]);

    const close = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    const save = () => {
        const input = {
            name: name.trim() || "New habit",
            goal,
            icon,
            tod,
            verb: verb.trim() || undefined,
        };
        if (isEdit && id) {
            update.mutate({ id, input }, { onSuccess: close });
        } else {
            create.mutate(input, { onSuccess: close });
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* top bar */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: th.d.pad,
                        marginBottom: 12,
                    }}
                >
                    <Pressable onPress={close}>
                        <Icon name="x" size={24} stroke={th.ink} />
                    </Pressable>
                    <Text
                        style={{
                            fontSize: 13,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.6,
                        }}
                    >
                        {isEdit ? "EDIT HABIT" : "NEW HABIT"}
                    </Text>
                    <Pressable onPress={save} disabled={pending}>
                        <Text
                            style={{
                                fontSize: 14,
                                fontFamily: th.sansBold,
                                color: th.accent,
                            }}
                        >
                            {pending ? "…" : "Save"}
                        </Text>
                    </Pressable>
                </View>

                {/* preview */}
                <View style={{ alignItems: "center", marginBottom: 4 }}>
                    <Plant streak={1} doneToday size={116} />
                </View>

                {/* name */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 18 }}>
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder="Run outside"
                        placeholderTextColor={th.muted}
                        style={{
                            fontFamily: th.display,
                            fontSize: 30,
                            color: th.ink,
                            textAlign: "center",
                            paddingVertical: 4,
                        }}
                    />
                    <View
                        style={{
                            height: 2,
                            backgroundColor: th.line,
                            marginTop: 2,
                        }}
                    />
                    <TextInput
                        value={verb}
                        onChangeText={setVerb}
                        placeholder="short note · e.g. 20 min"
                        placeholderTextColor={th.muted}
                        style={{
                            fontFamily: th.sans,
                            fontSize: 13,
                            color: th.ink2,
                            textAlign: "center",
                            marginTop: 10,
                        }}
                    />
                </View>

                {/* seed icons */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 22 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginBottom: 8,
                        }}
                    >
                        SEED
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 8,
                        }}
                    >
                        {ICONS.map((ic) => {
                            const on = icon === ic;
                            return (
                                <Pressable
                                    key={ic}
                                    onPress={() => setIcon(ic)}
                                    style={{
                                        width: "15%",
                                        aspectRatio: 1,
                                        borderRadius: 14,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: on
                                            ? th.accent
                                            : th.surface,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.accent : th.line,
                                    }}
                                >
                                    <Icon
                                        name={ic}
                                        size={18}
                                        stroke={on ? "#fff" : th.ink2}
                                        strokeWidth={1.8}
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* when */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 22 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginBottom: 8,
                        }}
                    >
                        WHEN
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {WHEN.map((o) => {
                            const on = tod === o.v;
                            return (
                                <Pressable
                                    key={o.v}
                                    onPress={() => setTod(o.v)}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 14,
                                        borderRadius: 16,
                                        alignItems: "center",
                                        gap: 6,
                                        backgroundColor: on
                                            ? th.ink
                                            : th.surface,
                                        borderWidth: 1.5,
                                        borderColor: on ? th.ink : th.line,
                                    }}
                                >
                                    <Icon
                                        name={o.i}
                                        size={18}
                                        stroke={on ? th.bg : th.ink2}
                                        strokeWidth={1.8}
                                    />
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            fontFamily: th.sansBold,
                                            color: on ? th.bg : th.ink,
                                        }}
                                    >
                                        {o.l}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* monthly goal */}
                <View style={{ paddingHorizontal: th.d.pad, marginBottom: 28 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 0.8,
                            marginBottom: 8,
                        }}
                    >
                        MONTHLY GOAL
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: th.line,
                            borderRadius: 16,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                        }}
                    >
                        <Pressable
                            onPress={() => setGoal((g) => Math.max(1, g - 1))}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: th.surface2,
                            }}
                        >
                            <Text style={{ fontSize: 22, color: th.ink }}>
                                −
                            </Text>
                        </Pressable>
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 24,
                                color: th.ink,
                            }}
                        >
                            {goal}{" "}
                            <Text style={{ fontSize: 14, color: th.muted }}>
                                days
                            </Text>
                        </Text>
                        <Pressable
                            onPress={() => setGoal((g) => Math.min(31, g + 1))}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: th.surface2,
                            }}
                        >
                            <Text style={{ fontSize: 22, color: th.ink }}>
                                +
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <View style={{ paddingHorizontal: th.d.pad }}>
                    <Pill
                        primary
                        icon="sprout"
                        label={
                            isEdit
                                ? pending
                                    ? "Saving…"
                                    : "Save changes"
                                : pending
                                  ? "Planting…"
                                  : "Plant this habit"
                        }
                        onPress={save}
                    />
                </View>
            </ScrollView>
        </View>
    );
}
