import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../theme/ThemeProvider";
import {
    useAdminUser,
    useAdminUserHabits,
    useDeleteUser,
    useRecordPayment,
    useUpdateUserStatus,
} from "../../../api/hooks";
import { AccountStatus } from "../../../lib/types";
import { deriveHabitStats, daysInMonth } from "../../../lib/deriveStats";
import { monthShort } from "../../../lib/date";
import { isDaily, scheduleLabel } from "../../../lib/schedule";
import { SkyWash, Card } from "../../../components/primitives";
import Icon from "../../../components/Icon";
import AdminHeader from "../../../components/admin/AdminHeader";
import StatusChip from "../../../components/admin/StatusChip";
import PaymentSheet from "../../../components/admin/PaymentSheet";

function shortDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.getDate()} ${monthShort[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AdminUserDetailScreen() {
    const th = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();

    const now = useMemo(() => new Date(), []);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);

    /** Which money sheet is open — approving someone, or just logging cash. */
    const [sheet, setSheet] = useState<"approve" | "payment" | null>(null);

    const { data: user, isLoading } = useAdminUser(id);
    const { data: rawHabits = [] } = useAdminUserHabits(id, year, month);

    const setStatusMutation = useUpdateUserStatus();
    const payment = useRecordPayment();
    const del = useDeleteUser();

    const dim = daysInMonth(year, month);
    const habits = useMemo(
        () => rawHabits.map((h) => deriveHabitStats(h, year, month, dim, now)),
        [rawHabits, year, month, dim, now],
    );

    const completed = habits.reduce((s, h) => s + h.completed, 0);
    const goal = habits.reduce((s, h) => s + h.goal, 0);

    const fail = (err: unknown) =>
        Alert.alert(
            "That didn't work",
            err instanceof Error ? err.message : "Please try again.",
        );

    const step = (delta: number) => {
        const d = new Date(year, month - 1 + delta, 1);
        setYear(d.getFullYear());
        setMonth(d.getMonth() + 1);
    };

    /** Approve = optional payment first, then ACTIVE. */
    async function approve(input: { amount: number | null; note: string }) {
        try {
            if (input.amount) {
                await payment.mutateAsync({
                    id,
                    amount: input.amount,
                    note: input.note || undefined,
                });
            }
            await setStatusMutation.mutateAsync({
                id,
                status: "ACTIVE",
                note: input.note || undefined,
            });
            setSheet(null);
        } catch (err) {
            setSheet(null);
            fail(err);
        }
    }

    async function recordPayment(input: {
        amount: number | null;
        note: string;
    }) {
        try {
            await payment.mutateAsync({
                id,
                amount: input.amount ?? 0,
                note: input.note || undefined,
            });
            setSheet(null);
        } catch (err) {
            setSheet(null);
            fail(err);
        }
    }

    const confirmStatus = (next: AccountStatus) => {
        const suspend = next === "SUSPENDED";
        Alert.alert(
            suspend ? `Suspend ${user?.name}?` : `Reactivate ${user?.name}?`,
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
                            .mutateAsync({ id, status: next })
                            .catch(fail),
                },
            ],
        );
    };

    const confirmDelete = () =>
        Alert.alert(
            `Delete ${user?.name}?`,
            "Their account, habits, check-ins and payment records are permanently removed. This can't be undone.",
            [
                { text: "Keep it", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                        del
                            .mutateAsync(id)
                            .then(() => router.replace("/admin/users"))
                            .catch(fail),
                },
            ],
        );

    if (isLoading || !user) {
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

    const isAdmin = user.role === "ADMIN";
    const monthLabel = `${monthShort[month - 1]} ${year}`;
    const atCurrentMonth =
        year === now.getFullYear() && month === now.getMonth() + 1;

    return (
        <View style={{ flex: 1, backgroundColor: th.bg }}>
            <SkyWash height={220} />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 8,
                    paddingBottom: 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                <AdminHeader title="Member" back="/admin/users" />

                {/* Profile */}
                <View style={{ paddingHorizontal: th.d.pad, marginTop: 16 }}>
                    <Card style={{ gap: 14 }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 14,
                            }}
                        >
                            {user.avatarUrl ? (
                                <Image
                                    source={{ uri: user.avatarUrl }}
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 28,
                                    }}
                                />
                            ) : (
                                <View
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 28,
                                        backgroundColor: th.accent,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: "#fff",
                                            fontFamily: th.sansBold,
                                            fontSize: 22,
                                        }}
                                    >
                                        {user.name?.[0]?.toUpperCase() ?? "?"}
                                    </Text>
                                </View>
                            )}
                            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        fontFamily: th.display,
                                        fontSize: 22 * th.d.font,
                                        color: th.ink,
                                    }}
                                >
                                    {user.name}
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={{ fontSize: 12.5, color: th.muted }}
                                >
                                    {user.email}
                                </Text>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <StatusChip status={user.status} />
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
                            </View>
                        </View>

                        <View
                            style={{
                                height: 1.5,
                                backgroundColor: th.bg,
                            }}
                        />

                        <View style={{ gap: 5 }}>
                            <Fact
                                label="Joined"
                                value={shortDate(user.createdAt)}
                            />
                            <Fact
                                label="Last active"
                                value={shortDate(user.lastActiveAt)}
                            />
                            <Fact
                                label="Habits"
                                value={String(user.habitCount)}
                            />
                            <Fact
                                label="Total paid"
                                value={`৳${user.totalPaid}`}
                            />
                            {user.lastAppVersion && (
                                <Fact
                                    label="App"
                                    value={`v${user.lastAppVersion}${
                                        user.lastAppPlatform
                                            ? ` · ${user.lastAppPlatform}`
                                            : ""
                                    }`}
                                />
                            )}
                            {user.statusChangedAt && (
                                <Fact
                                    label="Status changed"
                                    value={`${shortDate(user.statusChangedAt)}${
                                        user.statusNote
                                            ? ` — "${user.statusNote}"`
                                            : ""
                                    }`}
                                />
                            )}
                        </View>

                        {!isAdmin && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    flexWrap: "wrap",
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
                                                ? setSheet("approve")
                                                : confirmStatus("ACTIVE")
                                        }
                                    />
                                )}
                                {user.status === "ACTIVE" && (
                                    <Action
                                        label="Suspend"
                                        danger
                                        onPress={() =>
                                            confirmStatus("SUSPENDED")
                                        }
                                    />
                                )}
                                <Action
                                    label="Record payment"
                                    onPress={() => setSheet("payment")}
                                />
                                <Action
                                    label="Delete"
                                    onPress={confirmDelete}
                                />
                            </View>
                        )}
                    </Card>
                </View>

                {/* Their month, read-only */}
                <View
                    style={{
                        paddingHorizontal: th.d.pad,
                        marginTop: 18,
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Pressable
                            onPress={() => step(-1)}
                            hitSlop={10}
                            accessibilityLabel="Previous month"
                        >
                            <Icon
                                name="chevronLeft"
                                size={20}
                                stroke={th.ink2}
                            />
                        </Pressable>
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 19 * th.d.font,
                                color: th.ink,
                            }}
                        >
                            {monthLabel}
                        </Text>
                        <Pressable
                            onPress={() => step(1)}
                            hitSlop={10}
                            disabled={atCurrentMonth}
                            accessibilityLabel="Next month"
                        >
                            <Icon
                                name="chevronRight"
                                size={20}
                                stroke={atCurrentMonth ? th.line : th.ink2}
                            />
                        </Pressable>
                    </View>

                    <Card>
                        <Text
                            style={{
                                fontSize: 11,
                                fontFamily: th.sansBold,
                                color: th.muted,
                                letterSpacing: 0.7,
                            }}
                        >
                            CHECK-INS THIS MONTH
                        </Text>
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 30 * th.d.font,
                                color: th.ink,
                                marginTop: 4,
                            }}
                        >
                            {completed}
                            <Text style={{ fontSize: 16, color: th.muted }}>
                                {" "}
                                / {goal}
                            </Text>
                        </Text>
                        <View
                            style={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: th.surface2,
                                overflow: "hidden",
                                marginTop: 10,
                            }}
                        >
                            <View
                                style={{
                                    width: `${
                                        goal > 0
                                            ? Math.min(
                                                  100,
                                                  (completed / goal) * 100,
                                              )
                                            : 0
                                    }%`,
                                    height: "100%",
                                    borderRadius: 3,
                                    backgroundColor: th.accent,
                                }}
                            />
                        </View>
                    </Card>

                    {habits.length === 0 ? (
                        <Card style={{ alignItems: "center", gap: 6 }}>
                            <Icon
                                name="sprout"
                                size={28}
                                stroke={th.muted}
                                strokeWidth={1.5}
                            />
                            <Text style={{ color: th.muted }}>
                                Nothing planted this month.
                            </Text>
                        </Card>
                    ) : (
                        <Card pad={6}>
                            {habits.map((h, i) => (
                                <View
                                    key={h.id}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                        paddingVertical: th.d.rowPad,
                                        paddingHorizontal: 12,
                                        borderBottomWidth:
                                            i === habits.length - 1 ? 0 : 1.5,
                                        borderBottomColor: th.bg,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 17,
                                            borderWidth: 2,
                                            borderColor: th.line,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Icon
                                            name={h.icon}
                                            size={16}
                                            stroke={th.ink2}
                                            strokeWidth={1.8}
                                        />
                                    </View>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                            numberOfLines={1}
                                            style={{
                                                fontSize: 14.5,
                                                fontFamily: th.sansBold,
                                                color: th.ink,
                                            }}
                                        >
                                            {h.name}
                                        </Text>
                                        <Text
                                            style={{
                                                fontSize: 11.5,
                                                color: th.muted,
                                                marginTop: 1,
                                            }}
                                        >
                                            {h.completed}/{h.goal} this month
                                            {isDaily(h.daysOfWeek)
                                                ? ""
                                                : ` · ${scheduleLabel(
                                                      h.daysOfWeek,
                                                  )}`}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 4,
                                        }}
                                    >
                                        <Icon
                                            name="flame"
                                            size={13}
                                            stroke={th.accent}
                                            fill={th.accent}
                                            strokeWidth={1.2}
                                        />
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontFamily: th.sansBold,
                                                color: th.accent,
                                            }}
                                        >
                                            {h.streak}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </Card>
                    )}
                </View>

                {/* Payments */}
                <View
                    style={{
                        paddingHorizontal: th.d.pad,
                        marginTop: 18,
                        gap: 12,
                    }}
                >
                    <Text
                        style={{
                            fontFamily: th.display,
                            fontSize: 19 * th.d.font,
                            color: th.ink,
                        }}
                    >
                        Payments
                    </Text>
                    {user.payments.length === 0 ? (
                        <Card style={{ alignItems: "center" }}>
                            <Text style={{ color: th.muted }}>
                                No payments recorded yet.
                            </Text>
                        </Card>
                    ) : (
                        <Card pad={6}>
                            {user.payments.map((p, i) => (
                                <View
                                    key={p.id}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                        paddingVertical: 12,
                                        paddingHorizontal: 12,
                                        borderBottomWidth:
                                            i === user.payments.length - 1
                                                ? 0
                                                : 1.5,
                                        borderBottomColor: th.bg,
                                    }}
                                >
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text
                                            style={{
                                                fontSize: 14.5,
                                                fontFamily: th.sansBold,
                                                color: th.ink,
                                            }}
                                        >
                                            ৳{p.amount}{" "}
                                            <Text
                                                style={{
                                                    fontSize: 11.5,
                                                    fontFamily: th.sans,
                                                    color: th.muted,
                                                }}
                                            >
                                                {p.method.toLowerCase()}
                                            </Text>
                                        </Text>
                                        {p.note ? (
                                            <Text
                                                numberOfLines={1}
                                                style={{
                                                    fontSize: 11.5,
                                                    color: th.muted,
                                                    marginTop: 1,
                                                }}
                                            >
                                                {p.note}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <Text
                                        style={{
                                            fontSize: 11.5,
                                            color: th.muted,
                                        }}
                                    >
                                        {shortDate(p.createdAt)}
                                    </Text>
                                </View>
                            ))}
                        </Card>
                    )}
                </View>
            </ScrollView>

            <PaymentSheet
                visible={sheet === "approve"}
                title={`Approve ${user.name}?`}
                description="Their account becomes active immediately — even mid-session. Optionally record the cash you took."
                confirmLabel="Approve"
                busy={payment.isPending || setStatusMutation.isPending}
                onClose={() => setSheet(null)}
                onSubmit={approve}
            />
            <PaymentSheet
                visible={sheet === "payment"}
                title="Record a payment"
                description={`Log cash received from ${user.name} — no status change.`}
                confirmLabel="Record"
                requireAmount
                busy={payment.isPending}
                onClose={() => setSheet(null)}
                onSubmit={recordPayment}
            />
        </View>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    const th = useTheme();
    return (
        <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ fontSize: 12.5, color: th.muted, width: 104 }}>
                {label}
            </Text>
            <Text style={{ flex: 1, fontSize: 12.5, color: th.ink2 }}>
                {value}
            </Text>
        </View>
    );
}

function Action({
    label,
    primary,
    danger,
    onPress,
}: {
    label: string;
    primary?: boolean;
    danger?: boolean;
    onPress: () => void;
}) {
    const th = useTheme();
    const tint = danger ? th.danger : th.accent;
    return (
        <Pressable
            onPress={onPress}
            style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 16,
                backgroundColor: primary ? tint : "transparent",
                borderWidth: 1.5,
                borderColor: primary ? tint : th.line,
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
