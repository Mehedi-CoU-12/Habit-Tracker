import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useIsRestoring } from "@tanstack/react-query";
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
import { useMe } from "../api/hooks";
import { persistOptions, queryClient } from "../api/queryClient";
import { startSync } from "../offline/sync";
import { startReminders } from "../notifications";
import OfflineBar from "../components/OfflineBar";
import SyncPill from "../components/SyncPill";

function AuthGate() {
    const th = useTheme();
    const { ready, token } = useAuth();
    const segments = useSegments();
    const router = useRouter();
    // True while the persisted query cache is rehydrating from AsyncStorage.
    const isRestoring = useIsRestoring();

    const { data: me, isLoading } = useMe(ready && !!token);

    useEffect(() => {
        if (!ready) return;
        const top = segments[0];

        if (top === "google-auth") return;
        const inAuth = top === "login" || top === "signup";
        const onPending = top === "pending";

        if (!token) {
            if (!inAuth) router.replace("/login");
            return;
        }
        if (inAuth) {
            router.replace("/");
            return;
        }
        if (!me) return;
        if (me.status !== "ACTIVE" && !onPending) {
            router.replace("/pending");
        } else if (me.status === "ACTIVE" && onPending) {
            router.replace("/");
        }
    }, [ready, token, me, segments, router]);

    if (ready && token && (isRestoring || (!me && isLoading))) {
        return (
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 10,
                    backgroundColor: th.bg,
                }}
            />
        );
    }

    return null;
}

function RootStack() {
    const th = useTheme();
    // Wire the offline sync + reminder triggers once (reconnect / foreground /
    // startup for sync; foreground / actions / startup for reminders).
    useEffect(() => {
        startSync();
        startReminders();
    }, []);
    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <StatusBar style={th.dark ? "light" : "dark"} />
            <AuthGate />
            <OfflineBar />
            <SyncPill />
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
            <PersistQueryClientProvider
                client={queryClient}
                persistOptions={persistOptions}
            >
                <ThemeProvider>
                    <AuthProvider>
                        <RootStack />
                    </AuthProvider>
                </ThemeProvider>
            </PersistQueryClientProvider>
        </SafeAreaProvider>
    );
}
