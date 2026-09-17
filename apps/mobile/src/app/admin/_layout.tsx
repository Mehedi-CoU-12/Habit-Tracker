import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";
import { useMe } from "../../api/hooks";

/**
 * Second line of defence. The API already refuses every /admin route to a
 * non-admin, but a USER who deep-links here should see their own app, not an
 * error screen — so the whole group bounces home unless `me.role` is ADMIN.
 */
export default function AdminLayout() {
    const th = useTheme();
    const router = useRouter();
    const { data: me, isLoading } = useMe();

    const allowed = me?.role === "ADMIN";

    useEffect(() => {
        if (!isLoading && me && !allowed) router.replace("/");
    }, [isLoading, me, allowed, router]);

    if (!allowed) {
        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: th.bg,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ActivityIndicator color={th.accent} />
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: th.bg },
                animation: "fade",
            }}
        />
    );
}
