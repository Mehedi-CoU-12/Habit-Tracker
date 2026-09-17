import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../theme/ThemeProvider";
import Icon from "../Icon";

/** Back chevron + eyebrow + title, shared by every admin screen. */
export default function AdminHeader({
    title,
    subtitle,
    back = "/settings",
}: {
    title: string;
    subtitle?: string;
    /** Where the chevron goes when there's no history to pop (a deep link). */
    back?: string;
}) {
    const th = useTheme();
    const router = useRouter();

    const goBack = () =>
        router.canGoBack() ? router.back() : router.replace(back as never);

    return (
        <View style={{ paddingHorizontal: th.d.pad }}>
            <Pressable
                onPress={goBack}
                accessibilityLabel="Back"
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: th.surface,
                    borderWidth: 1.5,
                    borderColor: th.line,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icon name="chevronLeft" size={18} stroke={th.ink} />
            </Pressable>
            <Text
                style={{
                    fontSize: 11,
                    color: th.accent,
                    fontFamily: th.sansBold,
                    letterSpacing: 0.9,
                    marginTop: 14,
                }}
            >
                ADMIN
            </Text>
            <Text
                style={{
                    fontFamily: th.display,
                    fontSize: 32 * th.d.font,
                    color: th.ink,
                    marginTop: 2,
                }}
            >
                {title}
            </Text>
            {subtitle ? (
                <Text style={{ fontSize: 14, color: th.ink2, marginTop: 4 }}>
                    {subtitle}
                </Text>
            ) : null}
        </View>
    );
}
