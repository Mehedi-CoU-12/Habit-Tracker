import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useKeyboardVisible } from "../lib/useKeyboardVisible";
import Plant from "../components/Plant";
import { Pill } from "../components/primitives";
import { ApiError } from "../api/client";
import * as api from "../api/endpoints";

export default function ForgotPasswordScreen() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const kbVisible = useKeyboardVisible();

    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace("/login");

    const submit = async () => {
        const trimmed = email.trim();
        setError("");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            return setError("Enter a valid email address");
        }
        setLoading(true);
        try {
            await api.forgotPassword(trimmed);
            setSent(true);
        } catch (e) {
            // Only rate limiting and network failures land here — the API
            // never reports whether the address exists.
            if (e instanceof ApiError && e.status === 429) {
                setError(
                    "Too many attempts. Please wait a few minutes and try again.",
                );
            } else {
                setError(
                    e instanceof Error
                        ? e.message
                        : "Something went wrong — please try again",
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: th.bg }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                    paddingHorizontal: 28,
                    paddingTop: insets.top + 20,
                    paddingBottom: insets.bottom + 20,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {!kbVisible && (
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            alignItems: "flex-end",
                            marginBottom: 12,
                        }}
                    >
                        <Plant streak={sent ? 12 : 3} doneToday size={104} />
                    </View>
                )}

                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 30,
                        color: th.ink,
                        textAlign: "center",
                    }}
                >
                    {sent ? "Check your inbox" : "Forgot password?"}
                </Text>

                {sent ? (
                    <>
                        <Text
                            style={{
                                fontSize: 14,
                                color: th.ink2,
                                textAlign: "center",
                                marginTop: 8,
                                lineHeight: 21,
                            }}
                        >
                            If {email.trim()} has a HabitFlow account, a reset
                            link is on its way. It expires in 30 minutes.
                        </Text>
                        <Text
                            style={{
                                fontSize: 12,
                                color: th.muted,
                                textAlign: "center",
                                marginTop: 12,
                                lineHeight: 18,
                            }}
                        >
                            Nothing arrived? Check your spam folder. Accounts
                            created with Google get an email explaining that
                            instead.
                        </Text>
                        <Pill
                            primary
                            label="Back to sign in"
                            onPress={() => router.replace("/login")}
                            style={{ marginTop: 24 }}
                        />
                        <Pressable
                            onPress={() => setSent(false)}
                            style={{ marginTop: 14, alignSelf: "center" }}
                        >
                            <Text
                                style={{
                                    color: th.accent,
                                    fontFamily: th.sansBold,
                                    fontSize: 14,
                                }}
                            >
                                Use a different email
                            </Text>
                        </Pressable>
                    </>
                ) : (
                    <>
                        <Text
                            style={{
                                fontSize: 14,
                                color: th.ink2,
                                textAlign: "center",
                                marginTop: 6,
                                marginBottom: 24,
                                lineHeight: 21,
                            }}
                        >
                            Enter the email you signed up with and we&apos;ll
                            send a link to choose a new password.
                        </Text>

                        <View style={{ gap: 14 }}>
                            <View>
                                <Text
                                    style={{
                                        fontSize: 13,
                                        color: th.ink2,
                                        fontFamily: th.sansBold,
                                        marginBottom: 6,
                                    }}
                                >
                                    Email
                                </Text>
                                <TextInput
                                    value={email}
                                    onChangeText={(v) => {
                                        setEmail(v);
                                        setError("");
                                    }}
                                    placeholder="you@example.com"
                                    placeholderTextColor={th.muted}
                                    autoCapitalize="none"
                                    autoFocus
                                    keyboardType="email-address"
                                    onSubmitEditing={() => void submit()}
                                    style={{
                                        backgroundColor: th.surface,
                                        borderWidth: 1.5,
                                        borderColor: th.line,
                                        borderRadius: 12,
                                        paddingHorizontal: 14,
                                        paddingVertical: 12,
                                        fontSize: 15,
                                        color: th.ink,
                                        fontFamily: th.sans,
                                    }}
                                />
                            </View>

                            {error ? (
                                <Text
                                    style={{ color: "#dc2626", fontSize: 13 }}
                                >
                                    {error}
                                </Text>
                            ) : null}

                            <Pill
                                primary
                                label={loading ? "Sending…" : "Send reset link"}
                                onPress={() => {
                                    if (!loading) void submit();
                                }}
                                style={{ marginTop: 4 }}
                            />
                        </View>

                        <Pressable
                            onPress={goBack}
                            style={{ alignSelf: "center", marginTop: 24 }}
                        >
                            <Text
                                style={{
                                    color: th.accent,
                                    fontFamily: th.sansBold,
                                    fontSize: 14,
                                }}
                            >
                                Back to sign in
                            </Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
