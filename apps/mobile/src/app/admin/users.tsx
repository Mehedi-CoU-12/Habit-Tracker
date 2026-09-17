import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import {
    useAdminStats,
    useAdminUsers,
    useDeleteUser,
    useRecordPayment,
    useUpdateUserStatus,
} from "../../api/hooks";
import { AdminUserRow, AppClientPlatform } from "../../api/endpoints";
import { AccountStatus } from "../../lib/types";
import { monthShort } from "../../lib/date";
import { SkyWash, Card } from "../../components/primitives";
import Icon from "../../components/Icon";
import AdminHeader from "../../components/admin/AdminHeader";
import StatusChip from "../../components/admin/StatusChip";
import PaymentSheet from "../../components/admin/PaymentSheet";

const PAGE_SIZE = 20;

type StatusFilter = AccountStatus | "ALL";

// Pending first — that's the queue someone is actually waiting in.
const TABS: { key: StatusFilter; label: string }[] = [
    { key: "PENDING", label: "Pending" },
    { key: "ACTIVE", label: "Active" },
    { key: "SUSPENDED", label: "Suspended" },
    { key: "ALL", label: "All" },
];

const PLATFORM_LABEL: Record<AppClientPlatform, string> = {
    android: "Android",
    ios: "iOS",
    web: "Web",
};

/** "12 Sep 2025", or an em dash when the date is absent. */
function shortDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.getDate()} ${monthShort[d.getMonth()]} ${d.getFullYear()}`;
}

function Avatar({ user, size = 38 }: { user: AdminUserRow; size?: number }) {
    const th = useTheme();
    if (user.avatarUrl) {
        return (
            <Image
                source={{ uri: user.avatarUrl }}
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                }}
            />
        );
    }
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: th.accent,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Text
                style={{
                    color: "#fff",
                    fontFamily: th.sansBold,
                    fontSize: size * 0.4,
                }}
            >
                {user.name?.[0]?.toUpperCase() ?? "?"}
            </Text>
        </View>
    );
}

export default function AdminUsersScreen() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ status?: string }>();

    const deepLinked = params.status;
    const [status, setStatus] = useState<StatusFilter>(
        deepLinked === "PENDING" ||
            deepLinked === "ACTIVE" ||
            deepLinked === "SUSPENDED"
            ? deepLinked
            : "ALL",
    );
    const [typed, setTyped] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    /** The member being approved — the only action that also takes money. */
    const [approving, setApproving] = useState<AdminUserRow | null>(null);

    // Debounce the search box into the query filter.
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(typed.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [typed]);

    const filters = {
        ...(status !== "ALL" ? { status } : {}),
        ...(search ? { search } : {}),
        page,
        pageSize: PAGE_SIZE,
    };

    const { data, isLoading, isError } = useAdminUsers(filters);
    const { data: stats } = useAdminStats();

    const setStatusMutation = useUpdateUserStatus();
    const payment = useRecordPayment();
    const del = useDeleteUser();

    const users = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const tabCount = (key: StatusFilter): number | null => {
        if (!stats) return null;
        return key === "ALL" ? stats.totalUsers : stats.usersByStatus[key];
    };

    const fail = (err: unknown) =>
        Alert.alert(
            "That didn't work",
            err instanceof Error ? err.message : "Please try again.",
        );

    /** Approve = optional payment, then ACTIVE — the payment must land first. */
    async function approve(
        user: AdminUserRow,
        input: { amount: number | null; note: string },
    ) {
        try {
            if (input.amount) {
                await payment.mutateAsync({
                    id: user.id,
                    amount: input.amount,
                    note: input.note || undefined,
                });
            }
            await setStatusMutation.mutateAsync({
                id: user.id,
                status: "ACTIVE",
                note: input.note || undefined,
            });
            setApproving(null);
        } catch (err) {
            setApproving(null);
            fail(err);
        }
    }

    const confirmStatus = (user: AdminUserRow, next: AccountStatus) => {
        const suspend = next === "SUSPENDED";
        Alert.alert(
            suspend ? `Suspend ${user.name}?` : `Reactivate ${user.name}?`,
            suspend
                ? "They keep their data but lose access on their very next request. You can reactivate them at any time."
                : "Their access is restored on their very next request.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: suspend ? "Suspend" : "Reactivate",
                    style: suspend ? "destructive" : "default",
                    onPress: () =>
                        setStatusMutation
                            .mutateAsync({ id: user.id, status: next })
                            .catch(fail),
                },
            ],
        );
    };

    const confirmDelete = (user: AdminUserRow) =>
        Alert.alert(
            `Delete ${user.name}?`,
            "Their account, habits, check-ins and payment records are permanently removed. This can't be undone.",
            [
                { text: "Keep it", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => del.mutateAsync(user.id).catch(fail),
                },
            ],
        );

    const busy =
        setStatusMutation.isPending || del.isPending || payment.isPending;

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={220} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <AdminHeader title="Users" back="/admin" />

                {/* Status tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingHorizontal: th.d.pad,
                        gap: 8,
                        marginTop: 16,
                    }}
                >
                    {TABS.map((tab) => {
                        const on = status === tab.key;
                        const count = tabCount(tab.key);
                        return (
                            <Pressable
                                key={tab.key}
                                onPress={() => {
                                    setStatus(tab.key);
                                    setPage(1);
                                }}
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 14,
                                    borderRadius: 18,
                                    backgroundColor: on
                                        ? th.accent
                                        : th.surface,
                                    borderWidth: 1.5,
                                    borderColor: on ? th.accent : th.line,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12.5,
                                        fontFamily: th.sansBold,
                                        color: on ? "#fff" : th.ink2,
                                    }}
                                >
                                    {tab.label}
                                    {count !== null ? ` (${count})` : ""}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {/* Search */}
                <View style={{ paddingHorizontal: th.d.pad, marginTop: 12 }}>
                    <TextInput
                        value={typed}
                        onChangeText={setTyped}
                        placeholder="Search name or email…"
                        placeholderTextColor={th.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={{
                            backgroundColor: th.surface,
                            borderWidth: 1.5,
                            borderColor: th.line,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 11,
                            fontSize: 14.5,
                            color: th.ink,
                            fontFamily: th.sans,
                        }}
                    />
                </View>

                {isLoading && (
                    <ActivityIndicator
                        color={th.accent}
                        style={{ marginTop: 50 }}
                    />
                )}

                {isError && (
                    <Card style={{ margin: th.d.pad }}>
                        <Text style={{ color: th.ink2, textAlign: "center" }}>
                            Couldn&apos;t load users.
                        </Text>
                    </Card>
                )}

                {!isLoading && !isError && users.length === 0 && (
                    <Card
                        style={{
                            margin: th.d.pad,
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Icon
                            name="user"
                            size={30}
                            stroke={th.muted}
                            strokeWidth={1.5}
                        />
                        <Text style={{ color: th.muted, textAlign: "center" }}>
                            {search
                                ? "No users match your search."
                                : "No users here."}
                        </Text>
                    </Card>
                )}

                {/* Rows */}
                <View
                    style={{
                        paddingHorizontal: th.d.pad,
                        marginTop: 14,
                        gap: 10,
                        opacity: busy ? 0.6 : 1,
                    }}
                >
                    {users.map((user) => {
                        const isAdmin = user.role === "ADMIN";
                        return (
                            <Card key={user.id} style={{ gap: 12 }}>
                                <Pressable
                                    onPress={() =>
                                        router.push(`/admin/user/${user.id}`)
                                    }
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                    }}
                                >
                                    <Avatar user={user} />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            <Text
                                                numberOfLines={1}
                                                style={{
                                                    flexShrink: 1,
                                                    fontSize: 15,
                                                    fontFamily: th.sansBold,
                                                    color: th.ink,
                                                }}
                                            >
                                                {user.name}
                                            </Text>
                                            {isAdmin && (
                                                <Text
                                                    style={{
                                                        fontSize: 10,
                                                        fontFamily: th.sansBold,
                                                        color: th.deep,
                                                    }}
                                                >
                                                    ADMIN
                                                </Text>
                                            )}
                                        </View>
                                        <Text
                                            numberOfLines={1}
                                            style={{
                                                fontSize: 12,
                                                color: th.muted,
                                                marginTop: 1,
                                            }}
                                        >
                                            {user.email}
                                        </Text>
                                    </View>
                                    <StatusChip status={user.status} />
                                </Pressable>

                                <View
                                    style={{
                                        flexDirection: "row",
                                        flexWrap: "wrap",
                                        gap: 10,
                                    }}
                                >
                                    <Meta
                                        label={`${user.habitCount} habit${
                                            user.habitCount === 1 ? "" : "s"
                                        }`}
                                    />
                                    <Meta
                                        label={`joined ${shortDate(
                                            user.createdAt,
                                        )}`}
                                    />
                                    {user.lastActiveAt && (
                                        <Meta
                                            label={`active ${shortDate(
                                                user.lastActiveAt,
                                            )}`}
                                        />
                                    )}
                                    {user.lastAppPlatform && (
                                        <Meta
                                            label={
                                                user.lastAppVersion
                                                    ? `v${user.lastAppVersion} ${
                                                          PLATFORM_LABEL[
                                                              user
                                                                  .lastAppPlatform
                                                          ]
                                                      }`
                                                    : PLATFORM_LABEL[
                                                          user.lastAppPlatform
                                                      ]
                                            }
                                        />
                                    )}
                                    {user.totalPaid > 0 && (
                                        <Meta label={`৳${user.totalPaid}`} />
                                    )}
                                </View>

                                {!isAdmin && (
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            gap: 8,
                                        }}
                                    >
                                        {user.status !== "ACTIVE" && (
                                            <Action
                                                label={
                                                    user.status === "PENDING"
                                                        ? "Approve"
                                                        : "Reactivate"
                                                }
                                                primary
                                                onPress={() =>
                                                    user.status === "PENDING"
                                                        ? setApproving(user)
                                                        : confirmStatus(
                                                              user,
                                                              "ACTIVE",
                                                          )
                                                }
                                            />
                                        )}
                                        {user.status === "ACTIVE" && (
                                            <Action
                                                label="Suspend"
                                                danger
                                                onPress={() =>
                                                    confirmStatus(
                                                        user,
                                                        "SUSPENDED",
                                                    )
                                                }
                                            />
                                        )}
                                        <Action
                                            label="Delete"
                                            onPress={() => confirmDelete(user)}
                                        />
                                    </View>
                                )}
                            </Card>
                        );
                    })}
                </View>

                {/* Pagination */}
                {total > PAGE_SIZE && (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: th.d.pad,
                            marginTop: 18,
                        }}
                    >
                        <Action
                            label="← Prev"
                            disabled={page <= 1}
                            onPress={() => setPage((p) => p - 1)}
                        />
                        <Text style={{ fontSize: 12, color: th.muted }}>
                            Page {page} of {totalPages} · {total} user
                            {total === 1 ? "" : "s"}
                        </Text>
                        <Action
                            label="Next →"
                            disabled={page >= totalPages}
                            onPress={() => setPage((p) => p + 1)}
                        />
                    </View>
                )}
            </ScrollView>

            <PaymentSheet
                visible={!!approving}
                title={`Approve ${approving?.name ?? ""}?`}
                description="Their account becomes active immediately — even mid-session. Optionally record the cash you took."
                confirmLabel="Approve"
                busy={payment.isPending || setStatusMutation.isPending}
                onClose={() => setApproving(null)}
                onSubmit={(input) => approving && approve(approving, input)}
            />
        </View>
    );
}

/** One muted fact in a row's meta line. */
function Meta({ label }: { label: string }) {
    const th = useTheme();
    return <Text style={{ fontSize: 11.5, color: th.muted }}>{label}</Text>;
}

function Action({
    label,
    primary,
    danger,
    disabled,
    onPress,
}: {
    label: string;
    primary?: boolean;
    danger?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    const th = useTheme();
    const tint = danger ? th.danger : th.accent;
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 16,
                backgroundColor: primary ? tint : "transparent",
                borderWidth: 1.5,
                borderColor: primary ? tint : th.line,
                opacity: disabled ? 0.4 : 1,
            }}
        >
            <Text
                style={{
                    fontSize: 12.5,
                    fontFamily: th.sansBold,
                    color: primary ? "#fff" : danger ? th.danger : th.ink2,
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}
