import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../api/AuthProvider";
import { Pill } from "../components/primitives";

export default function GoogleAuthScreen() {
    const th = useTheme();
    const router = useRouter();
    const { code } = useLocalSearchParams<{ code?: string }>();
    const { completeGoogleSignIn } = useAuth();
    const [error, setError] = useState("");

    // Guard against re-runs from re-renders/param identity churn — the
    // exchange itself is also deduped per code in the AuthProvider.
    const ran = useRef(false);
    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        const c = Array.isArray(code) ? code[0] : code;
        if (!c) {
            router.replace("/login");
            return;
        }
        (async () => {
            try {
                const res = await completeGoogleSignIn(c);
                router.replace(res.user.status === "ACTIVE" ? "/" : "/pending");
            } catch (e) {
                setError(
                    e instanceof Error ? e.message : "Google sign-in failed",
                );
            }
        })();
    }, [code, completeGoogleSignIn, router]);

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: th.bg,
                alignItems: "center",
                justifyContent: "center",
                padding: 28,
                gap: 16,
            }}
        >
            {error ? (
                <>
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 22,
                            color: th.ink,
                            textAlign: "center",
                        }}
                    >
                        Sign-in didn&apos;t finish
                    </Text>
                    <Text
                        style={{
                            color: th.ink2,
                            fontSize: 14,
                            textAlign: "center",
                        }}
                    >
                        {error}
                    </Text>
                    <Pill
                        primary
                        label="Back to sign in"
                        onPress={() => router.replace("/login")}
                    />
                </>
            ) : (
                <>
                    <ActivityIndicator color={th.accent} />
                    <Text style={{ color: th.ink2, fontSize: 14 }}>
                        Signing you in with Google…
                    </Text>
                </>
            )}
        </View>
    );
}
