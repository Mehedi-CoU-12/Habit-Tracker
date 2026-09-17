import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { useAdminStats } from "../../api/hooks";
import { AdminStats } from "../../api/endpoints";
import { AccountStatus } from "../../lib/types";
import { SkyWash, Card } from "../../components/primitives";
import Icon from "../../components/Icon";
import AdminHeader from "../../components/admin/AdminHeader";
import { statusColor } from "../../components/admin/StatusChip";

function StatCard({
    label,
    value,
    sub,
    onPress,
    warn,
}: {
    label: string;
    value: number;
    sub?: string;
    onPress?: () => void;
    warn?: boolean;
}) {
    const th = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={!onPress}
            style={{ width: "50%", padding: 5 }}
        >
            <Card
                style={{
                    borderColor: warn ? th.accent : th.line,
                    minHeight: 104,
                }}
            >
                <Text
                    style={{
                        fontSize: 10,
                        fontFamily: th.sansBold,
                        color: warn ? th.accent : th.muted,
                        letterSpacing: 0.7,
                    }}
                    numberOfLines={1}
                >
                    {label.toUpperCase()}
                </Text>
                <Text
                    style={{
                        fontFamily: th.display,
                        fontSize: 30 * th.d.font,
                        color: th.ink,
                        marginTop: 4,
                    }}
                >
                    {value}
                </Text>
                {sub ? (
                    <Text style={{ fontSize: 11, color: th.muted }}>{sub}</Text>
                ) : null}
            </Card>
        </Pressable>
    );
}

/** Seven day-buckets as bars — the shape matters, not the exact pixels. */
function SignupsBars({ data }: { data: AdminStats["signupsLast7Days"] }) {
    const th = useTheme();
    const peak = Math.max(1, ...data.map((d) => d.count));
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 8,
                height: 108,
                marginTop: 14,
            }}
        >
            {data.map((d) => {
                // Day-of-week initial, read off the YYYY-MM-DD key as local time.
                const [y, m, day] = d.date.split("-").map(Number);
                const label = "SMTWTFS"[
                    new Date(y!, m! - 1, day!).getDay()
                ] as string;
                return (
                    <View
                        key={d.date}
                        style={{ flex: 1, alignItems: "center", gap: 5 }}
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                fontFamily: th.sansBold,
                                color: d.count > 0 ? th.ink : th.muted,
                            }}
                        >
                            {d.count}
                        </Text>
                        <View
                            style={{
                                width: "100%",
                                height: Math.max(4, (d.count / peak) * 64),
                                borderRadius: 5,
                                backgroundColor:
                                    d.count > 0 ? th.accent : th.surface2,
                            }}
                        />
                        <Text style={{ fontSize: 10, color: th.muted }}>
                            {label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

function StatusBreakdown({ stats }: { stats: AdminStats }) {
    const th = useTheme();
    const rows: { status: AccountStatus; label: string }[] = [
        { status: "ACTIVE", label: "Active" },
        { status: "PENDING", label: "Pending" },
        { status: "SUSPENDED", label: "Suspended" },
    ];
    const total = Math.max(1, stats.totalUsers);

    return (
        <View style={{ gap: 12, marginTop: 14 }}>
            {rows.map((r) => {
                const value = stats.usersByStatus[r.status];
                const color = statusColor(r.status, th.dark);
                return (
                    <View key={r.status} style={{ gap: 5 }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <View
                                style={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: 5,
                                    backgroundColor: color,
                                }}
                            />
                            <Text style={{ fontSize: 13.5, color: th.ink2 }}>
                                {r.label}
                            </Text>
                            <Text
                                style={{
                                    marginLeft: "auto",
                                    fontSize: 13.5,
                                    fontFamily: th.sansBold,
                                    color: th.ink,
                                }}
                            >
                                {value}
                            </Text>
                        </View>
                        <View
                            style={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: th.surface2,
                                overflow: "hidden",
                            }}
                        >
                            <View
                                style={{
                                    width: `${(value / total) * 100}%`,
                                    height: "100%",
                                    borderRadius: 3,
                                    backgroundColor: color,
                                }}
                            />
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

function SectionTitle({ children }: { children: string }) {
    const th = useTheme();
    return (
        <Text
            style={{
                fontFamily: th.display,
                fontSize: 19 * th.d.font,
                color: th.ink,
            }}
        >
            {children}
        </Text>
    );
}

export default function AdminOverviewScreen() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { data: stats, isLoading, isError } = useAdminStats();

    const signupsThisWeek =
        stats?.signupsLast7Days.reduce((sum, d) => sum + d.count, 0) ?? 0;

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={240} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                <AdminHeader
                    title="Overview"
                    subtitle="How the garden is doing, across everyone."
                />

                {isLoading && (
                    <ActivityIndicator
                        color={th.accent}
                        style={{ marginTop: 60 }}
                    />
                )}

                {isError && (
                    <Card style={{ margin: th.d.pad }}>
                        <Text style={{ color: th.ink2, textAlign: "center" }}>
                            Couldn&apos;t load admin stats.
                        </Text>
                    </Card>
                )}

                {stats && (
                    <>
                        <View
                            style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                paddingHorizontal: th.d.pad - 5,
                                marginTop: 16,
                            }}
                        >
                            <StatCard
                                label="Pending approvals"
                                value={stats.usersByStatus.PENDING}
                                sub="waiting for you"
                                warn={stats.usersByStatus.PENDING > 0}
                                onPress={() =>
                                    router.push("/admin/users?status=PENDING")
                                }
                            />
                            <StatCard
                                label="Active users"
                                value={stats.usersByStatus.ACTIVE}
                                sub={`of ${stats.totalUsers} accounts`}
                                onPress={() => router.push("/admin/users")}
                            />
                            <StatCard
                                label="Signups this week"
                                value={signupsThisWeek}
                                sub="last 7 days"
                            />
                            <StatCard
                                label="Active today"
                                value={stats.activeUsersToday}
                                sub={`${stats.logsToday} check-in${
                                    stats.logsToday === 1 ? "" : "s"
                                }`}
                            />
                        </View>

                        <View
                            style={{
                                paddingHorizontal: th.d.pad,
                                marginTop: 18,
                                gap: 16,
                            }}
                        >
                            <Card>
                                <SectionTitle>
                                    Signups · last 7 days
                                </SectionTitle>
                                <SignupsBars data={stats.signupsLast7Days} />
                            </Card>

                            <Card>
                                <SectionTitle>Accounts by status</SectionTitle>
                                <StatusBreakdown stats={stats} />
                            </Card>

                            <Card>
                                <SectionTitle>Everything planted</SectionTitle>
                                <Text
                                    style={{
                                        fontFamily: th.display,
                                        fontSize: 34 * th.d.font,
                                        color: th.ink,
                                        marginTop: 8,
                                    }}
                                >
                                    {stats.totalHabits}
                                </Text>
                                <Text
                                    style={{ fontSize: 12.5, color: th.muted }}
                                >
                                    habits across every account
                                </Text>
                            </Card>
                        </View>

                        <View
                            style={{
                                paddingHorizontal: th.d.pad,
                                marginTop: 16,
                                gap: 10,
                            }}
                        >
                            <NavRow
                                icon="user"
                                label="Users"
                                hint={`${stats.totalUsers} accounts`}
                                onPress={() => router.push("/admin/users")}
                            />
                            <NavRow
                                icon="archive"
                                label="App releases"
                                hint="Publish a build, set the minimum"
                                onPress={() => router.push("/admin/releases")}
                            />
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function NavRow({
    icon,
    label,
    hint,
    onPress,
}: {
    icon: string;
    label: string;
    hint: string;
    onPress: () => void;
}) {
    const th = useTheme();
    return (
        <Pressable onPress={onPress}>
            <Card
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                }}
            >
                <View
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 11,
                        backgroundColor: th.surface2,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Icon
                        name={icon}
                        size={16}
                        stroke={th.ink2}
                        strokeWidth={1.7}
                    />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        style={{
                            fontSize: 14.5,
                            color: th.ink,
                            fontFamily: th.sansBold,
                        }}
                    >
                        {label}
                    </Text>
                    <Text style={{ fontSize: 12, color: th.muted }}>
                        {hint}
                    </Text>
                </View>
                <Icon name="chevronRight" size={16} stroke={th.muted} />
            </Card>
        </Pressable>
    );
}
