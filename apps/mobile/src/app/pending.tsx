import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../api/AuthProvider";
import { useMe } from "../api/hooks";
import Plant from "../components/Plant";
import { Pill } from "../components/primitives";

export default function PendingScreen() {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const { signOut } = useAuth();
    const { data: me, refetch, isFetching } = useMe();

    const suspended = me?.status === "SUSPENDED";

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: th.bg }}
            contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                paddingHorizontal: 28,
                paddingTop: insets.top + 20,
                paddingBottom: insets.bottom + 20,
            }}
            refreshControl={
                <RefreshControl
                    refreshing={isFetching}
                    onRefresh={refetch}
                    tintColor={th.accent}
                />
            }
        >
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "flex-end",
                    marginBottom: 20,
                }}
            >
                <Plant streak={0} doneToday={false} size={70} />
                <Plant streak={0} doneToday size={96} />
                <Plant streak={0} doneToday={false} size={70} />
            </View>

            <Text
                style={{
                    fontFamily: th.display,
                    fontSize: 30,
                    color: th.ink,
                    textAlign: "center",
                }}
            >
                {suspended
                    ? "Your account is suspended"
                    : "Your garden is almost ready"}
            </Text>
            <Text
                style={{
                    fontSize: 14,
                    lineHeight: 21,
                    color: th.ink2,
                    textAlign: "center",
                    marginTop: 10,
                }}
            >
                {suspended
                    ? "Access to your garden has been paused. If you think this is a mistake, contact the admin to get reinstated."
                    : "Your account is awaiting activation — contact the admin to get approved. The moment you're in, this screen will take you straight to your garden."}
            </Text>
            {!suspended && (
                <Text
                    style={{
                        fontSize: 12,
                        color: th.muted,
                        textAlign: "center",
                        marginTop: 8,
                    }}
                >
                    Pull down to check again.
                </Text>
            )}

            <View style={{ gap: 12, marginTop: 28 }}>
                {!suspended && (
                    <Pill
                        primary
                        label={isFetching ? "Checking…" : "Check again"}
                        onPress={() => refetch()}
                    />
                )}
                <Pill label="Sign out" onPress={() => void signOut()} />
            </View>

            {me?.email && (
                <Text
                    style={{
                        fontSize: 12,
                        color: th.muted,
                        textAlign: "center",
                        marginTop: 24,
                    }}
                >
                    Signed in as {me.email}
                </Text>
            )}
        </ScrollView>
    );
}
