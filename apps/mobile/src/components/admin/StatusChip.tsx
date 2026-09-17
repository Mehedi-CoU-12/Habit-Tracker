import { Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { AccountStatus } from "../../lib/types";

/** Amber pending, green active, red suspended — label always carries the meaning. */
const TONE: Record<AccountStatus, { light: string; dark: string }> = {
    ACTIVE: { light: "#6FA86B", dark: "#5da158" },
    PENDING: { light: "#f59e0b", dark: "#d97706" },
    SUSPENDED: { light: "#ef4444", dark: "#ef4444" },
};

const LABEL: Record<AccountStatus, string> = {
    ACTIVE: "Active",
    PENDING: "Pending",
    SUSPENDED: "Suspended",
};

export function statusColor(status: AccountStatus, dark: boolean): string {
    return dark ? TONE[status].dark : TONE[status].light;
}

export default function StatusChip({ status }: { status: AccountStatus }) {
    const th = useTheme();
    const color = statusColor(status, th.dark);
    return (
        <View
            style={{
                alignSelf: "flex-start",
                paddingVertical: 3,
                paddingHorizontal: 9,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: color,
            }}
        >
            <Text
                style={{
                    fontSize: 10.5,
                    fontFamily: th.sansBold,
                    color,
                    letterSpacing: 0.3,
                }}
            >
                {LABEL[status]}
            </Text>
        </View>
    );
}
