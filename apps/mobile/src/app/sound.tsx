import { useRef, useState } from "react";
import {
    GestureResponderEvent,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { hexA } from "../theme/tokens";
import {
    SOUND_STYLES,
    SoundStyleId,
    SoundVariant,
    previewSound,
    setSoundPrefs,
    useSoundPrefs,
} from "../sound";
import { Card, Toggle } from "../components/primitives";
import Icon from "../components/Icon";

/**
 * Session sounds picker — port of the web SoundScreen (bloom-sound.jsx).
 * Master on/off + volume, then one card per synthesized style with Start/End
 * preview buttons. Tapping a card selects it and plays its end tone.
 */

/** Track-drag volume slider (no native slider dependency). */
function VolumeSlider({
    value,
    disabled,
    onChange,
    onRelease,
}: {
    value: number;
    disabled?: boolean;
    onChange: (v: number) => void;
    onRelease: () => void;
}) {
    const th = useTheme();
    const [width, setWidth] = useState(0);
    const set = (e: GestureResponderEvent) => {
        if (!width) return;
        onChange(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)));
    };
    const thumb = Math.max(0, Math.min(width - 18, value * width - 9));
    return (
        <View
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => !disabled}
            onMoveShouldSetResponder={() => !disabled}
            onResponderGrant={set}
            onResponderMove={set}
            onResponderRelease={onRelease}
            style={{ flex: 1, height: 34, justifyContent: "center" }}
        >
            <View
                style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: th.line,
                }}
            />
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    left: 0,
                    width: `${value * 100}%`,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: th.accent,
                }}
            />
            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    left: thumb,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: "#fff",
                    borderWidth: 1.5,
                    borderColor: th.line,
                    shadowColor: "#000",
                    shadowOpacity: 0.15,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 2,
                }}
            />
        </View>
    );
}

export default function SoundScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const prefs = useSoundPrefs();
    const [pulse, setPulse] = useState<string | null>(null);
    const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const preview = (id: SoundStyleId, variant: SoundVariant) => {
        previewSound(id, variant);
        setPulse(`${id}-${variant}`);
        if (pulseTimer.current) clearTimeout(pulseTimer.current);
        pulseTimer.current = setTimeout(() => setPulse(null), 420);
    };
    const select = (id: SoundStyleId) => {
        setSoundPrefs({ style: id });
        preview(id, "end");
    };
    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace("/");

    const MiniBtn = ({
        id,
        variant,
        label,
    }: {
        id: SoundStyleId;
        variant: SoundVariant;
        label: string;
    }) => {
        const active = pulse === `${id}-${variant}`;
        const fg = active ? th.deep : th.ink2;
        return (
            <Pressable
                onPress={() => preview(id, variant)}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingVertical: 6,
                    paddingHorizontal: 11,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: active ? th.accent : th.line,
                    backgroundColor: active
                        ? hexA(th.accent, 0.14)
                        : th.surface,
                }}
            >
                <Icon name="play2" size={11} stroke={fg} />
                <Text
                    style={{
                        fontSize: 11.5,
                        fontFamily: th.sansBold,
                        color: fg,
                    }}
                >
                    {label}
                </Text>
            </Pressable>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <LinearGradient
                colors={[hexA(th.accent, th.dark ? 0.14 : 0.18), th.bg]}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 150 + insets.top,
                }}
                pointerEvents="none"
            />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 28 + insets.bottom,
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
                    }}
                >
                    <Pressable
                        onPress={goBack}
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
                            fontSize: 13,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 1.5,
                        }}
                    >
                        SOUND
                    </Text>
                    <View style={{ width: 38 }} />
                </View>

                <View style={{ paddingHorizontal: th.d.pad, paddingTop: 10 }}>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 34 * th.d.font,
                            color: th.ink,
                        }}
                    >
                        Session sounds
                    </Text>
                    <Text
                        style={{
                            fontSize: 14,
                            color: th.ink2,
                            marginTop: 6,
                            lineHeight: 20,
                            fontFamily: th.sans,
                        }}
                    >
                        A gentle nudge at the start and end of each focus
                        session.
                    </Text>
                </View>

                {/* master card: toggle + volume */}
                <Card
                    pad={18}
                    style={{ marginHorizontal: th.d.pad, marginTop: 18 }}
                >
                    <View
                        style={{
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
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    backgroundColor: prefs.on
                                        ? hexA(th.accent, 0.16)
                                        : th.surface2,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Icon
                                    name={prefs.on ? "volume" : "volumeOff"}
                                    size={20}
                                    stroke={prefs.on ? th.accent : th.muted}
                                    strokeWidth={1.8}
                                />
                            </View>
                            <View>
                                <Text
                                    style={{
                                        fontSize: 15,
                                        fontFamily: th.sansBold,
                                        color: th.ink,
                                    }}
                                >
                                    Sounds
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: th.muted,
                                        marginTop: 1,
                                        fontFamily: th.sans,
                                    }}
                                >
                                    {prefs.on ? "On" : "Off"}
                                </Text>
                            </View>
                        </View>
                        <Toggle
                            on={prefs.on}
                            onPress={() => setSoundPrefs({ on: !prefs.on })}
                        />
                    </View>

                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            marginTop: 16,
                            opacity: prefs.on ? 1 : 0.4,
                        }}
                        pointerEvents={prefs.on ? "auto" : "none"}
                    >
                        <Icon name="volumeOff" size={16} stroke={th.muted} />
                        <VolumeSlider
                            value={prefs.volume}
                            disabled={!prefs.on}
                            onChange={(v) => setSoundPrefs({ volume: v })}
                            onRelease={() => previewSound(prefs.style, "start")}
                        />
                        <Icon name="volume" size={18} stroke={th.ink2} />
                    </View>
                </Card>

                {/* sound list */}
                <View
                    style={{
                        paddingHorizontal: th.d.pad,
                        paddingTop: 20,
                        opacity: prefs.on ? 1 : 0.5,
                        gap: 10,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 11,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            letterSpacing: 1.2,
                        }}
                    >
                        CHOOSE A SOUND
                    </Text>
                    {SOUND_STYLES.map((s) => {
                        const on = prefs.style === s.id;
                        return (
                            <Pressable
                                key={s.id}
                                onPress={() => select(s.id)}
                                style={{
                                    backgroundColor: th.surface,
                                    borderRadius: th.d.radius - 2,
                                    padding: 16,
                                    borderWidth: 1.5,
                                    borderColor: on ? th.accent : th.line,
                                    shadowColor: on ? th.accent : "transparent",
                                    shadowOpacity: on ? 0.16 : 0,
                                    shadowRadius: 9,
                                    shadowOffset: { width: 0, height: 6 },
                                    elevation: on ? 4 : 0,
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "flex-start",
                                        gap: 12,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: 13,
                                            backgroundColor: on
                                                ? th.accent
                                                : th.surface2,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Icon
                                            name={s.icon}
                                            size={20}
                                            stroke={on ? "#fff" : th.ink2}
                                            strokeWidth={1.8}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 15.5,
                                                    fontFamily: th.sansBold,
                                                    color: th.ink,
                                                }}
                                            >
                                                {s.name}
                                            </Text>
                                            {s.tag && (
                                                <View
                                                    style={{
                                                        backgroundColor: hexA(
                                                            th.accent,
                                                            0.16,
                                                        ),
                                                        paddingVertical: 2,
                                                        paddingHorizontal: 7,
                                                        borderRadius: 7,
                                                    }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 9.5,
                                                            fontFamily:
                                                                th.sansBold,
                                                            letterSpacing: 0.6,
                                                            color: th.deep,
                                                        }}
                                                    >
                                                        {s.tag.toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                            {on && (
                                                <View
                                                    style={{
                                                        marginLeft: "auto",
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: 11,
                                                        backgroundColor:
                                                            th.accent,
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
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
                                        </View>
                                        <Text
                                            style={{
                                                fontSize: 12.5,
                                                color: th.ink2,
                                                marginTop: 3,
                                                lineHeight: 17,
                                                fontFamily: th.sans,
                                            }}
                                        >
                                            {s.desc}
                                        </Text>
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                gap: 8,
                                                marginTop: 12,
                                            }}
                                        >
                                            <MiniBtn
                                                id={s.id}
                                                variant="start"
                                                label="Start"
                                            />
                                            <MiniBtn
                                                id={s.id}
                                                variant="end"
                                                label="End"
                                            />
                                        </View>
                                    </View>
                                </View>
                            </Pressable>
                        );
                    })}
                    <Text
                        style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: th.muted,
                            fontStyle: "italic",
                            fontFamily: th.display,
                            textAlign: "center",
                        }}
                    >
                        Tap a card to preview and set it. ☿
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
