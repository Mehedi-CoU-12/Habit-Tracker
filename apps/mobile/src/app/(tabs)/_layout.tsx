import { Pressable, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { hexA } from "../../theme/tokens";
import Icon from "../../components/Icon";

const ICONS: Record<string, string> = {
    index: "home",
    calendar: "calendar",
    stats: "chart",
    settings: "user",
};

type TabRoute = { key: string; name: string };
type TabBarProps = {
    state: { index: number; routes: TabRoute[] };
    navigation: {
        emit: (e: {
            type: "tabPress";
            target: string;
            canPreventDefault: boolean;
        }) => { defaultPrevented: boolean };
        navigate: (name: string) => void;
    };
};

function BloomTabBar({ state, navigation }: TabBarProps) {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // first half (index, calendar) · [ + ] · second half (stats, settings)
    const routes = state.routes.filter((r) => ICONS[r.name]);
    const mid = Math.ceil(routes.length / 2);
    const left = routes.slice(0, mid);
    const right = routes.slice(mid);

    const TabButton = ({
        routeName,
        routeKey,
        index,
    }: {
        routeName: string;
        routeKey: string;
        index: number;
    }) => {
        const focused = state.index === index;
        return (
            <Pressable
                key={routeKey}
                onPress={() => {
                    const event = navigation.emit({
                        type: "tabPress",
                        target: routeKey,
                        canPreventDefault: true,
                    });
                    if (!focused && !event.defaultPrevented) {
                        navigation.navigate(routeName);
                    }
                }}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: focused
                        ? hexA(th.accent, 0.2)
                        : "transparent",
                }}
            >
                <Icon
                    name={ICONS[routeName]}
                    size={22}
                    stroke={focused ? th.accent : th.dark ? "#888" : "#C9BBA6"}
                    strokeWidth={focused ? 2 : 1.6}
                />
            </Pressable>
        );
    };

    return (
        <View
            style={{
                position: "absolute",
                left: 18,
                right: 18,
                bottom: Math.max(insets.bottom, 14),
                height: 64,
                borderRadius: 32,
                backgroundColor: th.dark ? "#000" : th.ink,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-around",
                paddingHorizontal: 18,
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
            }}
        >
            {left.map((r) => (
                <TabButton
                    key={r.key}
                    routeName={r.name}
                    routeKey={r.key}
                    index={state.routes.indexOf(r)}
                />
            ))}

            {/* center + → Add */}
            <Pressable
                onPress={() => router.push("/add")}
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: th.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: th.accent,
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                }}
            >
                <Icon name="plus" size={24} stroke="#fff" strokeWidth={2.4} />
            </Pressable>

            {right.map((r) => (
                <TabButton
                    key={r.key}
                    routeName={r.name}
                    routeKey={r.key}
                    index={state.routes.indexOf(r)}
                />
            ))}
        </View>
    );
}

export default function TabsLayout() {
    return (
        <Tabs
            tabBar={(props) => (
                <BloomTabBar {...(props as unknown as TabBarProps)} />
            )}
            screenOptions={{ headerShown: false }}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="calendar" />
            <Tabs.Screen name="stats" />
            <Tabs.Screen name="settings" />
        </Tabs>
    );
}
