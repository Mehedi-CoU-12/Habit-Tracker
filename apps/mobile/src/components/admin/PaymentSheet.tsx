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
import Icon from "../Icon";
import { Pill } from "../primitives";

type Props = {
    visible: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    /** Recording a payment needs an amount; approving someone may be free. */
    requireAmount?: boolean;
    busy?: boolean;
    error?: string;
    onClose: () => void;
    onSubmit: (payload: { amount: number | null; note: string }) => void;
};

/**
 * The two money flows, sharing one sheet: approving a member (payment
 * optional — you may be waving a friend through) and logging a standalone
 * payment (amount required). Mirrors the web PaymentDialog's rules.
 */
export default function PaymentSheet(props: Props) {
    return (
        <Modal
            visible={props.visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={props.onClose}
        >
            {props.visible ? <Sheet {...props} /> : null}
        </Modal>
    );
}

function Sheet({
    title,
    description,
    confirmLabel,
    requireAmount = false,
    busy = false,
    error,
    onClose,
    onSubmit,
}: Props) {
    const th = useTheme();
    const insets = useSafeAreaInsets();
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [local, setLocal] = useState("");
    const rise = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(rise, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [rise]);

    const shown = local || error;

    const inputStyle = {
        backgroundColor: th.bg,
        borderWidth: 1.5,
        borderColor: shown ? th.danger : th.line,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: th.ink,
        fontFamily: th.sans,
        marginTop: 8,
    } as const;

    function submit() {
        if (busy) return;
        const trimmed = amount.trim();
        const parsed = trimmed === "" ? null : Number(trimmed);
        if (requireAmount && (parsed === null || parsed <= 0)) {
            setLocal("Enter the amount that was paid.");
            return;
        }
        if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) {
            setLocal("Amount must be a whole number of Taka.");
            return;
        }
        setLocal("");
        onSubmit({ amount: parsed, note: note.trim() });
    }

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
                            backgroundColor: th.accentSoftBg,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icon
                            name="handshake"
                            size={21}
                            stroke={th.deep}
                            strokeWidth={1.9}
                        />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            style={{
                                fontFamily: th.display,
                                fontSize: 21 * th.d.font,
                                color: th.ink,
                            }}
                        >
                            {title}
                        </Text>
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
                    {description}
                </Text>

                <Text
                    style={{
                        fontSize: 11,
                        fontFamily: th.sansBold,
                        color: th.muted,
                        letterSpacing: 0.6,
                        marginTop: 16,
                    }}
                >
                    AMOUNT {requireAmount ? "(TAKA)" : "(OPTIONAL)"}
                </Text>
                <TextInput
                    value={amount}
                    onChangeText={(t) => {
                        setAmount(t);
                        if (local) setLocal("");
                    }}
                    placeholder="500"
                    placeholderTextColor={th.muted}
                    keyboardType="number-pad"
                    editable={!busy}
                    style={inputStyle}
                />

                <Text
                    style={{
                        fontSize: 11,
                        fontFamily: th.sansBold,
                        color: th.muted,
                        letterSpacing: 0.6,
                        marginTop: 14,
                    }}
                >
                    NOTE (OPTIONAL)
                </Text>
                <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="bKash, paid in person…"
                    placeholderTextColor={th.muted}
                    editable={!busy}
                    style={inputStyle}
                />

                {shown ? (
                    <Text
                        style={{
                            color: th.danger,
                            fontSize: 12.5,
                            marginTop: 10,
                        }}
                    >
                        {shown}
                    </Text>
                ) : null}

                <Pill
                    primary
                    icon={busy ? undefined : "check"}
                    label={busy ? "Saving…" : confirmLabel}
                    onPress={busy ? undefined : submit}
                    style={{ marginTop: 16, opacity: busy ? 0.5 : 1 }}
                />
                {busy ? (
                    <ActivityIndicator
                        color={th.muted}
                        style={{ marginTop: 10 }}
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
                            Cancel
                        </Text>
                    </Pressable>
                )}
            </Animated.View>
        </View>
    );
}
