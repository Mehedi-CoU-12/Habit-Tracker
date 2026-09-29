import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    Modal,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeProvider";
import { useDeleteUser, useUpdateUserStatus } from "../../api/hooks";
import Icon from "../Icon";
import { Pill } from "../primitives";

type Kind = "suspend" | "reactivate" | "delete";
type Member = { id: string; name: string; email?: string };

const COPY: Record<
    Kind,
    {
        icon: string;
        title: (name: string) => string;
        body: string;
        confirm: string;
        busy: string;
        danger: boolean;
    }
> = {
    suspend: {
        icon: "x",
        title: (n) => `Suspend ${n}?`,
        body: "They keep all their data but lose access on their next request. You can reactivate them at any time.",
        confirm: "Suspend",
        busy: "Suspending…",
        danger: true,
    },
    reactivate: {
        icon: "sprout",
        title: (n) => `Reactivate ${n}?`,
        body: "Their access comes back on their next request, with everything as they left it.",
        confirm: "Reactivate",
        busy: "Reactivating…",
        danger: false,
    },
    delete: {
        icon: "trash",
        title: (n) => `Delete ${n}?`,
        body: "This permanently removes:",
        confirm: "Delete forever",
        busy: "Deleting…",
        danger: true,
    },
};

const DELETED = [
    "Their account and sign-in",
    "Every habit and check-in",
    "Notes and focus history",
];

/** Suspend / reactivate / delete a member through one themed confirm sheet. */
export function useMemberActions(onDeleted?: () => void) {
    const [pending, setPending] = useState<{
        kind: Kind;
        member: Member;
    } | null>(null);
    const [error, setError] = useState<string | undefined>();
    const status = useUpdateUserStatus();
    const del = useDeleteUser();
    const busy = status.isPending || del.isPending;

    const open = (kind: Kind) => (member: Member) => {
        setError(undefined);
        setPending({ kind, member });
    };

    async function confirm(note: string) {
        if (!pending) return;
        const { kind, member } = pending;
        setError(undefined);
        try {
            if (kind === "delete") {
                await del.mutateAsync(member.id);
            } else {
                await status.mutateAsync({
                    id: member.id,
                    status: kind === "suspend" ? "SUSPENDED" : "ACTIVE",
                    note: note || undefined,
                });
            }
            setPending(null);
            if (kind === "delete") onDeleted?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Please try again.");
        }
    }

    const sheet = (
        <MemberActionSheet
            kind={pending?.kind ?? null}
            member={pending?.member ?? null}
            busy={busy}
            error={error}
            onClose={() => !busy && setPending(null)}
            onConfirm={confirm}
        />
    );

    return {
        suspend: open("suspend"),
        reactivate: open("reactivate"),
        remove: open("delete"),
        busy,
        sheet,
    };
}

function MemberActionSheet({
    kind,
    member,
    busy,
    error,
    onClose,
    onConfirm,
}: {
    kind: Kind | null;
    member: Member | null;
    busy: boolean;
    error?: string;
    onClose: () => void;
    onConfirm: (note: string) => void;
}) {
    const visible = kind !== null && member !== null;
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            {visible ? (
                <Sheet
                    kind={kind}
                    member={member}
                    busy={busy}
                    error={error}
                    onClose={onClose}
                    onConfirm={onConfirm}
                />
            ) : null}
        </Modal>
    );
}

function Sheet({
    kind,
    member,
    busy,
    error,
    onClose,
    onConfirm,
}: {
    kind: Kind;
    member: Member;
    busy: boolean;
    error?: string;
    onClose: () => void;
    onConfirm: (note: string) => void;
}) {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const [note, setNote] = useState("");
    const rise = useRef(new Animated.Value(0)).current;
    const c = COPY[kind];
    const tint = c.danger ? th.danger : th.deep;

    useEffect(() => {
        Animated.timing(rise, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [rise]);

    return (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <Pressable
                onPress={busy ? undefined : onClose}
                style={{ flex: 1, backgroundColor: th.overlay }}
            />
            <Animated.View
                style={{
                    backgroundColor: th.surface,
                    borderTopLeftRadius: th.d.radius + 6,
                    borderTopRightRadius: th.d.radius + 6,
                    borderWidth: 1.5,
                    borderBottomWidth: 0,
                    borderColor: th.line,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: insets.bottom + 16,
                    opacity: rise,
                    transform: [
                        {
                            translateY: rise.interpolate({
                                inputRange: [0, 1],
                                outputRange: [36, 0],
                            }),
                        },
                    ],
                }}
            >
                <View
                    style={{
                        alignSelf: "center",
                        width: 44,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: th.line,
                        marginBottom: 16,
                    }}
                />

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                    <View
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 15,
                            backgroundColor: c.danger
                                ? th.dangerSoft
                                : th.accentSoftBg,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icon
                            name={c.icon}
                            size={21}
                            stroke={tint}
                            strokeWidth={1.9}
                        />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            numberOfLines={2}
                            style={{
                                fontFamily: th.display,
                                fontSize: 21 * th.d.font,
                                color: th.ink,
                            }}
                        >
                            {c.title(member.name)}
                        </Text>
                        {member.email ? (
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontSize: 12.5,
                                    color: th.muted,
                                    marginTop: 2,
                                }}
                            >
                                {member.email}
                            </Text>
                        ) : null}
                    </View>
                </View>

                <Text
                    style={{
                        fontSize: 13.5,
                        color: th.ink2,
                        lineHeight: 20,
                        marginTop: 14,
                    }}
                >
                    {c.body}
                </Text>

                {kind === "delete" && (
                    <View
                        style={{
                            marginTop: 10,
                            padding: 12,
                            gap: 8,
                            borderRadius: 14,
                            backgroundColor: th.dangerSoft,
                        }}
                    >
                        {DELETED.map((line) => (
                            <View
                                key={line}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <Icon
                                    name="x"
                                    size={13}
                                    stroke={th.danger}
                                    strokeWidth={2.2}
                                />
                                <Text style={{ fontSize: 13, color: th.ink }}>
                                    {line}
                                </Text>
                            </View>
                        ))}
                        <Text
                            style={{
                                fontSize: 12,
                                color: th.ink2,
                                marginTop: 2,
                            }}
                        >
                            Payment records stay in the ledger. This can&apos;t
                            be undone.
                        </Text>
                    </View>
                )}

                {kind === "suspend" && (
                    <>
                        <Text
                            style={{
                                fontSize: 11,
                                fontFamily: th.sansBold,
                                color: th.muted,
                                letterSpacing: 0.6,
                                marginTop: 16,
                            }}
                        >
                            REASON (OPTIONAL)
                        </Text>
                        <TextInput
                            value={note}
                            onChangeText={setNote}
                            placeholder="Payment overdue, asked to pause…"
                            placeholderTextColor={th.muted}
                            editable={!busy}
                            maxLength={200}
                            style={{
                                backgroundColor: th.bg,
                                borderWidth: 1.5,
                                borderColor: th.line,
                                borderRadius: 12,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                fontSize: 15,
                                color: th.ink,
                                fontFamily: th.sans,
                                marginTop: 8,
                            }}
                        />
                    </>
                )}

                {error ? (
                    <Text
                        style={{
                            color: th.danger,
                            fontSize: 12.5,
                            marginTop: 12,
                        }}
                    >
                        {error}
                    </Text>
                ) : null}

                <Pill
                    primary
                    danger={c.danger}
                    icon={busy ? undefined : c.icon}
                    label={busy ? c.busy : c.confirm}
                    onPress={busy ? undefined : () => onConfirm(note.trim())}
                    style={{ marginTop: 18, opacity: busy ? 0.6 : 1 }}
                />
                {busy ? (
                    <ActivityIndicator
                        color={th.muted}
                        style={{ marginTop: 14, marginBottom: 6 }}
                    />
                ) : (
                    <Pressable
                        onPress={onClose}
                        style={{ paddingVertical: 14, marginTop: 6 }}
                    >
                        <Text
                            style={{
                                textAlign: "center",
                                fontSize: 14.5,
                                color: th.muted,
                                fontFamily: th.sansBold,
                            }}
                        >
                            {kind === "delete" ? "Keep member" : "Cancel"}
                        </Text>
                    </Pressable>
                )}
            </Animated.View>
        </View>
    );
}
