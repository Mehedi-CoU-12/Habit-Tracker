import { useEffect, useState } from "react";
import {
    Linking,
    Modal,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { useAppRelease } from "../api/hooks";
import { KEYS, storage } from "../lib/storage";
import { currentAppVersion, isOlderThan } from "../lib/version";
import Icon from "./Icon";
import { Pill } from "./primitives";

export default function UpdateGate() {
    const th = useTheme();
    const { data: release } = useAppRelease();
    const current = currentAppVersion();
    const [dismissed, setDismissed] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let active = true;
        void storage.get(KEYS.updateDismissed).then((v) => {
            if (!active) return;
            setDismissed(v);
            setReady(true);
        });
        return () => {
            active = false;
        };
    }, []);

    if (!release || !current || !ready) return null;

    const required = isOlderThan(current, release.minimum);
    const available = isOlderThan(current, release.latest);
    if (!required && !available) return null;
    // A forced update ignores any earlier dismissal.
    if (!required && dismissed === release.latest) return null;

    const onUpdate = () => {
        void Linking.openURL(release.url).catch(() => {});
    };

    const onLater = () => {
        setDismissed(release.latest);
        void storage.set(KEYS.updateDismissed, release.latest);
    };

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            // Android hardware back must not escape a forced update.
            onRequestClose={required ? () => {} : onLater}
            statusBarTranslucent
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: th.overlay,
                    justifyContent: "center",
                    padding: 24,
                }}
            >
                <View
                    style={{
                        backgroundColor: th.surface,
                        borderRadius: th.d.radius,
                        borderWidth: 1.5,
                        borderColor: th.line,
                        padding: 22,
                        maxHeight: "80%",
                    }}
                >
                    <View
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 23,
                            backgroundColor: th.accentSoftBg,
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 14,
                        }}
                    >
                        <Icon
                            name="sparkle"
                            size={22}
                            stroke={th.accent}
                            strokeWidth={1.8}
                        />
                    </View>

                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 24 * th.d.font,
                            color: th.ink,
                        }}
                    >
                        {required
                            ? "Update required"
                            : "A new version is ready"}
                    </Text>

                    <Text
                        style={{
                            fontSize: 13,
                            color: th.muted,
                            fontFamily: th.sansBold,
                            marginTop: 6,
                        }}
                    >
                        HabitFlow {release.latest} · you have {current}
                    </Text>

                    <Text
                        style={{
                            fontSize: 13.5,
                            color: th.ink2,
                            lineHeight: 20,
                            marginTop: 12,
                        }}
                    >
                        {required
                            ? "This version is no longer supported. Update to keep using HabitFlow — your habits are safe and will be right here."
                            : "Grab the latest build for the newest features and fixes."}
                    </Text>

                    {release.notes ? (
                        <ScrollView
                            style={{ marginTop: 14, maxHeight: 180 }}
                            contentContainerStyle={{
                                backgroundColor: th.surface2,
                                borderRadius: 14,
                                padding: 14,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    color: th.ink2,
                                    lineHeight: 20,
                                }}
                            >
                                {release.notes}
                            </Text>
                        </ScrollView>
                    ) : null}

                    <Pill
                        primary
                        icon="arrowRight"
                        label="Download update"
                        onPress={onUpdate}
                        style={{ marginTop: 18 }}
                    />

                    {!required && (
                        <Pressable
                            onPress={onLater}
                            style={{ paddingVertical: 12, marginTop: 4 }}
                        >
                            <Text
                                style={{
                                    textAlign: "center",
                                    fontSize: 14,
                                    fontFamily: th.sansBold,
                                    color: th.muted,
                                }}
                            >
                                Not now
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}
