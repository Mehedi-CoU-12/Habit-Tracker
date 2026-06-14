import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Plant — the signature Bloom element, ported to react-native-svg.
 * Grows seed → sprout → leafy stem → flower by `streak`; wilts (dim + tilt)
 * when not done today. Colors read from the active theme.
 */
export default function Plant({
    streak = 0,
    doneToday = false,
    size = 80,
    flowerColor,
}: {
    streak?: number;
    doneToday?: boolean;
    size?: number;
    flowerColor?: string;
}) {
    const th = useTheme();
    const stage =
        streak === 0 ? 0 : streak < 3 ? 1 : streak < 10 ? 2 : streak < 25 ? 3 : 4;
    const dim = doneToday ? 1 : 0.5;
    const leaf = th.green;
    const flower = flowerColor ?? th.accent;
    const tilt = doneToday ? 0 : -3;

    return (
        <Svg width={size} height={size} viewBox="0 0 100 100">
            {/* Pot */}
            <Path d="M28 78 L72 78 L68 94 L32 94 Z" fill={th.dirt} />
            <Rect x={26} y={74} width={48} height={6} rx={2} fill={th.deep} opacity={0.85} />
            <Ellipse cx={50} cy={76} rx={22} ry={3} fill={th.potShadow} opacity={0.4} />

            {stage === 0 && (
                <Ellipse cx={50} cy={74} rx={6} ry={2} fill={th.potShadow} />
            )}

            {stage >= 1 && (
                <G opacity={dim} origin="50, 76" rotation={tilt}>
                    <Path
                        d={
                            stage === 1
                                ? "M50 76 L50 64"
                                : stage === 2
                                  ? "M50 76 L50 50"
                                  : stage === 3
                                    ? "M50 76 L50 36"
                                    : "M50 76 L50 28"
                        }
                        stroke={th.greenDeep}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        fill="none"
                    />
                </G>
            )}

            {stage >= 1 && (
                <G opacity={dim}>
                    <Ellipse cx={44} cy={64} rx={6} ry={3} fill={leaf} rotation={-30} origin="44, 64" />
                    <Ellipse cx={56} cy={62} rx={6} ry={3} fill={leaf} rotation={30} origin="56, 62" />
                </G>
            )}
            {stage >= 2 && (
                <G opacity={dim}>
                    <Ellipse cx={40} cy={56} rx={8} ry={4} fill={leaf} rotation={-25} origin="40, 56" />
                    <Ellipse cx={60} cy={54} rx={8} ry={4} fill={leaf} rotation={25} origin="60, 54" />
                </G>
            )}
            {stage >= 3 && (
                <G opacity={dim}>
                    <Ellipse cx={38} cy={44} rx={9} ry={4.5} fill={leaf} rotation={-20} origin="38, 44" />
                    <Ellipse cx={62} cy={42} rx={9} ry={4.5} fill={leaf} rotation={20} origin="62, 42" />
                </G>
            )}
            {stage >= 4 && (
                <G opacity={dim}>
                    <Circle cx={42} cy={28} r={4} fill={flower} />
                    <Circle cx={50} cy={22} r={5} fill={flower} />
                    <Circle cx={58} cy={28} r={4} fill={flower} />
                    <Circle cx={50} cy={34} r={4} fill={flower} />
                    <Circle cx={50} cy={28} r={3} fill={th.sun} />
                </G>
            )}
        </Svg>
    );
}
