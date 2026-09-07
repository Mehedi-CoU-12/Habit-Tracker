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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../api/AuthProvider";
import { useKeyboardVisible } from "../lib/useKeyboardVisible";
import Plant from "../components/Plant";
import { Pill } from "../components/primitives";
import * as api from "../api/endpoints";

/**
 * Landing screen for the `habitflow://reset-password?token=…` deep link the
 * reset email (via the web page) hands over.
 *
 * On success it signs in with the password just chosen: the reset bumped
 * tokenVersion, so any session on this device is already dead, and dropping
 * the user on a blank login form after they proved they own the mailbox is
 * one form too many.
 */
export default function ResetPasswordScreen() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const kbVisible = useKeyboardVisible();
    const { signIn } = useAuth();
    const params = useLocalSearchParams<{ token?: string | string[] }>();
    const token = Array.isArray(params.token) ? params.token[0] : params.token;

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const inputStyle = {
        backgroundColor: th.surface,
        borderWidth: 1.5,
        borderColor: th.line,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: th.ink,
        fontFamily: th.sans,
    } as const;

    const submit = async () => {
        setError("");
        if (password.length < 8) {
            return setError("Password must be at least 8 characters");
        }
        if (password !== confirm) {
            return setError("The two passwords don't match");
        }
        setLoading(true);
        try {
            const { email } = await api.resetPassword(token ?? "", password);
            try {
                const res = await signIn(email, password);
                router.replace(res.user.status === "ACTIVE" ? "/" : "/pending");
                return;
            } catch {
                // The password did change — only the courtesy sign-in failed
                // (offline, or the account is gated). Say so and let the user
                // sign in when they can.
                setDone(true);
            }
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "Something went wrong — please try again",
            );
        } finally {
            setLoading(false);
        }
    };

    const shell = (children: React.ReactNode) => (
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
                {children}
            </ScrollView>
        </KeyboardAvoidingView>
    );

    const heading = (text: string) => (
        <Text
            style={{
                fontFamily: th.display,
                fontSize: 30,
                color: th.ink,
                textAlign: "center",
            }}
        >
            {text}
        </Text>
    );

    const body = (text: string) => (
        <Text
            style={{
                fontSize: 14,
                color: th.ink2,
                textAlign: "center",
                marginTop: 8,
                lineHeight: 21,
            }}
        >
            {text}
        </Text>
    );

    if (!token) {
        return shell(
            <>
                {heading("This link is incomplete")}
                {body(
                    "Open the link from your reset email, or ask for a new one.",
                )}
                <Pill
                    primary
                    label="Request a new link"
                    onPress={() => router.replace("/forgot-password")}
                    style={{ marginTop: 24 }}
                />
            </>,
        );
    }

    if (done) {
        return shell(
            <>
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        marginBottom: 12,
                    }}
                >
                    <Plant streak={12} doneToday size={104} />
                </View>
                {heading("Password changed")}
                {body(
                    "Every device that was signed in has been signed out. Use your new password to come back.",
                )}
                <Pill
                    primary
                    label="Sign in"
                    onPress={() => router.replace("/login")}
                    style={{ marginTop: 24 }}
                />
            </>,
        );
    }

    return shell(
        <>
            {!kbVisible && (
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        marginBottom: 12,
                    }}
                >
                    <Plant streak={3} doneToday size={104} />
                </View>
            )}
            {heading("Choose a new password")}
            {body("At least 8 characters. This link works once.")}

            <View style={{ gap: 14, marginTop: 24 }}>
                <View>
                    <Text
                        style={{
                            fontSize: 13,
                            color: th.ink2,
                            fontFamily: th.sansBold,
                            marginBottom: 6,
                        }}
                    >
                        New password
                    </Text>
                    <TextInput
                        value={password}
                        onChangeText={(v) => {
                            setPassword(v);
                            setError("");
                        }}
                        placeholder="Enter a new password"
                        placeholderTextColor={th.muted}
                        secureTextEntry
                        autoFocus
                        style={inputStyle}
                    />
                </View>
                <View>
                    <Text
                        style={{
                            fontSize: 13,
                            color: th.ink2,
                            fontFamily: th.sansBold,
                            marginBottom: 6,
                        }}
                    >
                        Confirm password
                    </Text>
                    <TextInput
                        value={confirm}
                        onChangeText={(v) => {
                            setConfirm(v);
                            setError("");
                        }}
                        placeholder="Type it again"
                        placeholderTextColor={th.muted}
                        secureTextEntry
                        onSubmitEditing={() => {
                            if (!loading) void submit();
                        }}
                        style={inputStyle}
                    />
                </View>

                {error ? (
                    <Text style={{ color: "#dc2626", fontSize: 13 }}>
                        {error}
                    </Text>
                ) : null}

                <Pill
                    primary
                    label={loading ? "Saving…" : "Set new password"}
                    onPress={() => {
                        if (!loading) void submit();
                    }}
                    style={{ marginTop: 4 }}
                />
            </View>

            <Pressable
                onPress={() => router.replace("/login")}
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
        </>,
    );
}
