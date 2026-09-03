import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    Modal,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import Icon from "./Icon";
import { Pill } from "./primitives";

/** What a passwordless (Google) account types to prove it means it. */
const DELETE_WORD = "DELETE";

type Props = {
    visible: boolean;
    /** Google-only accounts have no password to give — they type the word. */
    hasPassword: boolean;
    email?: string;
    onClose: () => void;
    onConfirm: (input: {
        password?: string;
        confirmation?: string;
    }) => Promise<void>;
};

/**
 * Two-step destructive confirmation for account deletion, weighted the same as
 * HabitSheet's delete step: what goes, what it costs, then a re-authentication
 * the user has to actually perform. A borrowed unlocked phone should not be
 * able to erase two years of history in three taps.
 */
export default function DeleteAccountSheet(props: Props) {
    return (
        <Modal
            visible={props.visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={props.onClose}
        >
            {props.visible ? <Sheet {...props} /> : null}
        </Modal>
    );
}

function Sheet({ hasPassword, email, onClose, onConfirm }: Props) {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState<"warn" | "verify">("warn");
    const [secret, setSecret] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const rise = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(rise, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [rise]);

    const ready = hasPassword
        ? secret.length > 0
        : secret.trim().toUpperCase() === DELETE_WORD;

    async function confirm() {
        if (!ready || busy) return;
        setBusy(true);
        setError("");
        try {
            await onConfirm(
                hasPassword ? { password: secret } : { confirmation: secret },
            );
            // On success the session is already torn down and this screen is
            // unmounted — nothing left to reset.
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Could not delete your account. Please try again.",
            );
            setBusy(false);
        }
    }

    const inputStyle = {
        backgroundColor: th.bg,
        borderWidth: 1.5,
        borderColor: error ? th.danger : th.line,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: th.ink,
        fontFamily: th.sans,
        marginTop: 10,
    } as const;

    return (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable
                onPress={busy ? undefined : onClose}
                style={{ flex: 1, backgroundColor: th.overlay }}
            />
            <Animated.View
                style={{
                    backgroundColor: th.surface,
                    borderTopLeftRadius: th.d.radius + 6,
                    borderTopRightRadius: th.d.radius + 6,
                    borderWidth: 1.5,
                    borderBottomWidth: 0,
                    borderColor: th.line,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: insets.bottom + 16,
                    opacity: rise,
                    transform: [
                        {
                            translateY: rise.interpolate({
                                inputRange: [0, 1],
                                outputRange: [36, 0],
                            }),
                        },
                    ],
                }}
            >
                <View
                    style={{
                        alignSelf: "center",
                        width: 44,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: th.line,
                        marginBottom: 16,
                    }}
                />

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 15,
                            backgroundColor: th.dangerSoft,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icon
                            name="trash"
                            size={21}
                            stroke={th.danger}
                            strokeWidth={1.9}
                        />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 21 * th.d.font,
                                color: th.ink,
                            }}
                        >
                            Delete your account?
                        </Text>
                        {email ? (
                            <Text
                                style={{
                                    fontSize: 12,
                                    color: th.muted,
                                    marginTop: 2,
                                }}
                                numberOfLines={1}
                            >
                                {email}
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View
                    style={{
                        height: 1.5,
                        backgroundColor: th.line,
                        marginTop: 16,
                        marginBottom: 12,
                    }}
                />

                {step === "warn" ? (
                    <>
                        <View
                            style={{
                                backgroundColor: th.dangerSoft,
                                borderRadius: 14,
                                padding: 14,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13.5,
                                    color: th.ink2,
                                    lineHeight: 20,
                                }}
                            >
                                Every habit, check-in, note and focus session on
                                this account is erased everywhere, on every
                                device. This cannot be undone and there is no
                                grace period.
                            </Text>
                        </View>
                        <Pill
                            primary
                            danger
                            icon="trash"
                            label="Continue"
                            onPress={() => setStep("verify")}
                            style={{ marginTop: 14 }}
                        />
                        <Cancel label="Keep my account" onPress={onClose} />
                    </>
                ) : (
                    <>
                        <Text
                            style={{
                                fontSize: 13.5,
                                color: th.ink2,
                                lineHeight: 20,
                            }}
                        >
                            {hasPassword
                                ? "Enter your password to confirm it is really you."
                                : `This account signs in with Google, so type ${DELETE_WORD} to confirm.`}
                        </Text>
                        <TextInput
                            value={secret}
                            onChangeText={(t) => {
                                setSecret(t);
                                if (error) setError("");
                            }}
                            placeholder={
                                hasPassword ? "Your password" : DELETE_WORD
                            }
                            placeholderTextColor={th.muted}
                            secureTextEntry={hasPassword}
                            autoCapitalize={
                                hasPassword ? "none" : "characters"
                            }
                            autoCorrect={false}
                            editable={!busy}
                            style={inputStyle}
                        />
                        {error ? (
                            <Text
                                style={{
                                    color: th.danger,
                                    fontSize: 12.5,
                                    marginTop: 8,
                                }}
                            >
                                {error}
                            </Text>
                        ) : null}
                        <Pill
                            primary
                            danger
                            icon={busy ? undefined : "trash"}
                            label={busy ? "Deleting…" : "Delete forever"}
                            onPress={ready && !busy ? confirm : undefined}
                            style={{
                                marginTop: 14,
                                opacity: ready && !busy ? 1 : 0.5,
                            }}
                        />
                        {busy ? (
                            <ActivityIndicator
                                color={th.muted}
                                style={{ marginTop: 10 }}
                            />
                        ) : (
                            <Cancel label="Cancel" onPress={onClose} />
                        )}
                    </>
                )}
            </Animated.View>
        </View>
    );
}

/** The way out, weighted like HabitSheet's — present, not loud. */
function Cancel({ label, onPress }: { label: string; onPress: () => void }) {
    const th = useTheme();
    return (
        <Pressable
            onPress={onPress}
            style={{ paddingVertical: 14, marginTop: 6 }}
        >
            <Text
                style={{
                    textAlign: "center",
                    fontSize: 14.5,
                    color: th.muted,
                    fontFamily: th.sansBold,
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}
