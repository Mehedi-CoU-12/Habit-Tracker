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
import { useAuth } from "../api/AuthProvider";
import { useKeyboardVisible } from "../lib/useKeyboardVisible";
import Plant from "../components/Plant";
import Icon from "../components/Icon";
import GoogleButton from "../components/GoogleButton";
import { Pill } from "../components/primitives";

export default function SignupScreen() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const kbVisible = useKeyboardVisible();
    const { register, signInWithGoogle } = useAuth();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

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
        if (!name.trim()) return setError("Name is required");
        if (password.length < 8)
            return setError("Password must be at least 8 characters");
        setLoading(true);
        try {
            const res = await register(name.trim(), email.trim(), password);
            // Signups are auto-approved, so this normally goes to onboarding;
            // the /pending fallback stays for a parked/suspended account.
            router.replace(
                res.user.status === "ACTIVE" ? "/onboarding" : "/pending",
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Signup failed");
        } finally {
            setLoading(false);
        }
    };

    const google = async () => {
        if (loading) return;
        setError("");
        setLoading(true);
        try {
            const res = await signInWithGoogle();
            if (!res) return;

            router.replace(res.user.status === "ACTIVE" ? "/" : "/pending");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Google sign-in failed");
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
                            marginBottom: 8,
                        }}
                    >
                        <Plant streak={0} doneToday size={70} />
                        <Plant streak={6} doneToday size={96} />
                        <Plant streak={30} doneToday size={114} />
                    </View>
                )}

                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 20,
                    }}
                >
                    <View
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            backgroundColor: th.accent,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icon
                            name="sprout"
                            size={17}
                            stroke="#fff"
                            strokeWidth={2}
                        />
                    </View>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 22,
                            color: th.ink,
                        }}
                    >
                        HabitFlow
                    </Text>
                </View>

                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 32,
                        color: th.ink,
                        textAlign: "center",
                    }}
                >
                    Create your account
                </Text>
                <Text
                    style={{
                        fontSize: 14,
                        color: th.ink2,
                        textAlign: "center",
                        marginTop: 4,
                        marginBottom: 24,
                    }}
                >
                    Plant your first seed — it&apos;s free forever.
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
                            Full name
                        </Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Jane Doe"
                            placeholderTextColor={th.muted}
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
                            Email
                        </Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@example.com"
                            placeholderTextColor={th.muted}
                            autoCapitalize="none"
                            keyboardType="email-address"
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
                            Password
                        </Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="At least 8 characters"
                            placeholderTextColor={th.muted}
                            secureTextEntry
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
                        label={loading ? "Creating account…" : "Create account"}
                        onPress={submit}
                        style={{ marginTop: 4 }}
                    />

                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            marginVertical: 4,
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                height: 1,
                                backgroundColor: th.line,
                            }}
                        />
                        <Text
                            style={{
                                color: th.muted,
                                fontSize: 12,
                                fontFamily: th.sansBold,
                            }}
                        >
                            OR
                        </Text>
                        <View
                            style={{
                                flex: 1,
                                height: 1,
                                backgroundColor: th.line,
                            }}
                        />
                    </View>

                    <GoogleButton onPress={() => void google()} />
                </View>

                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        marginTop: 24,
                        gap: 4,
                    }}
                >
                    <Text style={{ color: th.ink2, fontSize: 14 }}>
                        Already have an account?
                    </Text>
                    <Pressable onPress={() => router.push("/login")}>
                        <Text
                            style={{
                                color: th.accent,
                                fontFamily: th.sansBold,
                                fontSize: 14,
                            }}
                        >
                            Sign in
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
