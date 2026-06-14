import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Caprasimo_400Regular } from "@expo-google-fonts/caprasimo";
import {
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";

import { ThemeProvider, useTheme } from "../theme/ThemeProvider";
import { AuthProvider, useAuth } from "../api/AuthProvider";

/** Redirects between the auth screens and the app based on token presence. */
function AuthGate() {
    const { ready, token } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (!ready) return;
        const top = segments[0];
        const inAuth = top === "login" || top === "signup";
        if (!token && !inAuth) {
            router.replace("/login");
        } else if (token && inAuth) {
            router.replace("/");
        }
    }, [ready, token, segments, router]);

    return null;
}

function RootStack() {
    const th = useTheme();
    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <StatusBar style={th.dark ? "light" : "dark"} />
            <AuthGate />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: th.bg },
                    animation: "fade",
                }}
            >
                <Stack.Screen name="add" options={{ presentation: "modal" }} />
            </Stack>
        </View>
    );
}

export default function RootLayout() {
    const [client] = useState(
        () =>
            new QueryClient({
                defaultOptions: { queries: { staleTime: 60 * 1000 } },
            }),
    );

    const [loaded] = useFonts({
        Caprasimo_400Regular,
        Manrope_400Regular,
        Manrope_500Medium,
        Manrope_600SemiBold,
        Manrope_700Bold,
        Manrope_800ExtraBold,
        JetBrainsMono_500Medium,
    });

    if (!loaded) return null;

    return (
        <SafeAreaProvider>
            <QueryClientProvider client={client}>
                <ThemeProvider>
                    <AuthProvider>
                        <RootStack />
                    </AuthProvider>
                </ThemeProvider>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
