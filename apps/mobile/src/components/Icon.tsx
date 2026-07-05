import { ReactNode } from "react";
import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";

/** Inline SVG icon set ported from the Bloom prototype (24px viewbox). */
const PATHS: Record<string, (s: string, fill: string) => ReactNode> = {
    check: () => <Polyline points="4 12.5 9.5 18 20 6.5" />,
    plus: () => (
        <>
            <Line x1={12} y1={5} x2={12} y2={19} />
            <Line x1={5} y1={12} x2={19} y2={12} />
        </>
    ),
    chevronRight: () => <Polyline points="9 5 16 12 9 19" />,
    chevronLeft: () => <Polyline points="15 5 8 12 15 19" />,
    flame: () => (
        <Path d="M12 3 c2 3 4 4 4 8 a4 4 0 0 1 -8 0 c0 -2 1 -3 2 -4 c-1 4 2 4 2 0 c0 -2 0 -3 0 -4z" />
    ),
    leaf: () => (
        <>
            <Path d="M5 19 c0 -9 6 -14 14 -14 c0 8 -5 14 -14 14 z" />
            <Path d="M5 19 c4 -4 8 -8 14 -14" />
        </>
    ),
    sun: () => (
        <>
            <Circle cx={12} cy={12} r={4} />
            <Line x1={12} y1={2} x2={12} y2={5} />
            <Line x1={12} y1={19} x2={12} y2={22} />
            <Line x1={2} y1={12} x2={5} y2={12} />
            <Line x1={19} y1={12} x2={22} y2={12} />
            <Line x1={4.5} y1={4.5} x2={6.5} y2={6.5} />
            <Line x1={17.5} y1={17.5} x2={19.5} y2={19.5} />
            <Line x1={4.5} y1={19.5} x2={6.5} y2={17.5} />
            <Line x1={17.5} y1={6.5} x2={19.5} y2={4.5} />
        </>
    ),
    moon: () => <Path d="M20 14 a8 8 0 0 1 -10 -10 a8 8 0 1 0 10 10 z" />,
    cloud: () => (
        <Path d="M6 18 a4 4 0 0 1 0 -8 a5 5 0 0 1 10 1 a3 3 0 0 1 0 7 z" />
    ),
    bell: () => (
        <>
            <Path d="M6 16 v-4 a6 6 0 0 1 12 0 v4 l1.5 2 h-15 z" />
            <Path d="M10 19 a2 2 0 0 0 4 0" />
        </>
    ),
    settings: () => (
        <>
            <Circle cx={12} cy={12} r={3} />
            <Path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M4.5 4.5 l2 2 M17.5 17.5 l2 2 M4.5 19.5 l2 -2 M17.5 6.5 l2 -2" />
        </>
    ),
    chart: () => (
        <>
            <Polyline points="3 17 9 11 13 15 21 6" />
            <Polyline points="15 6 21 6 21 12" />
        </>
    ),
    book: () => (
        <>
            <Path d="M4 4 h6 a3 3 0 0 1 2 1 a3 3 0 0 1 2 -1 h6 v15 h-6 a3 3 0 0 0 -2 1 a3 3 0 0 0 -2 -1 h-6 z" />
            <Path d="M12 5 v15" />
        </>
    ),
    droplet: () => (
        <Path d="M12 3 c4 5 6 8 6 11 a6 6 0 0 1 -12 0 c0 -3 2 -6 6 -11z" />
    ),
    dumbbell: () => (
        <>
            <Rect x={2} y={9} width={3} height={6} />
            <Rect x={19} y={9} width={3} height={6} />
            <Rect x={6} y={7} width={3} height={10} />
            <Rect x={15} y={7} width={3} height={10} />
            <Line x1={9} y1={12} x2={15} y2={12} />
        </>
    ),
    moonStars: (s, fill) => (
        <>
            <Path d="M20 14 a7 7 0 0 1 -10 -10 a8 8 0 1 0 10 10z" />
            <Circle cx={17} cy={7} r={0.7} fill={s} />
            <Circle cx={14} cy={4} r={0.5} fill={s} />
        </>
    ),
    pen: () => (
        <>
            <Path d="M14 4 l6 6 L9 21 H3 v-6 z" />
            <Line x1={13} y1={5} x2={19} y2={11} />
        </>
    ),
    home: () => <Path d="M3 11 l9 -8 l9 8 v10 h-6 v-6 h-6 v6 h-6 z" />,
    user: () => (
        <>
            <Circle cx={12} cy={8} r={4} />
            <Path d="M3 21 c2 -5 6 -7 9 -7 s7 2 9 7" />
        </>
    ),
    arrowRight: () => (
        <>
            <Line x1={4} y1={12} x2={20} y2={12} />
            <Polyline points="14 6 20 12 14 18" />
        </>
    ),
    coffee: () => (
        <>
            <Path d="M4 8 h13 v7 a4 4 0 0 1 -4 4 h-5 a4 4 0 0 1 -4 -4 z" />
            <Path d="M17 10 h2 a2 2 0 0 1 0 5 h-2" />
            <Line x1={8} y1={3} x2={8} y2={5} />
            <Line x1={11} y1={3} x2={11} y2={5} />
            <Line x1={14} y1={3} x2={14} y2={5} />
        </>
    ),
    music: () => (
        <>
            <Path d="M9 18 v-13 l11 -2 v13" />
            <Circle cx={6} cy={18} r={3} />
            <Circle cx={17} cy={16} r={3} />
        </>
    ),
    sparkle: () => (
        <Path d="M12 3 l2 7 l7 2 l-7 2 l-2 7 l-2 -7 l-7 -2 l7 -2 z" />
    ),
    calendar: () => (
        <>
            <Rect x={3} y={5} width={18} height={16} rx={2} />
            <Line x1={3} y1={10} x2={21} y2={10} />
            <Line x1={8} y1={3} x2={8} y2={7} />
            <Line x1={16} y1={3} x2={16} y2={7} />
        </>
    ),
    trophy: () => (
        <>
            <Path d="M6 4 h12 v4 a4 4 0 0 1 -4 4 h-4 a4 4 0 0 1 -4 -4 z" />
            <Path d="M6 5 H3 v2 a3 3 0 0 0 3 3" />
            <Path d="M18 5 h3 v2 a3 3 0 0 1 -3 3" />
            <Path d="M9 21 h6" />
            <Path d="M12 12 v9" />
        </>
    ),
    x: () => (
        <>
            <Line x1={6} y1={6} x2={18} y2={18} />
            <Line x1={18} y1={6} x2={6} y2={18} />
        </>
    ),
    list: () => (
        <>
            <Line x1={4} y1={6} x2={20} y2={6} />
            <Line x1={4} y1={12} x2={20} y2={12} />
            <Line x1={4} y1={18} x2={20} y2={18} />
        </>
    ),
    grid3: () => (
        <>
            <Rect x={3} y={3} width={6} height={6} />
            <Rect x={11} y={3} width={6} height={6} />
            <Rect x={3} y={11} width={6} height={6} />
            <Rect x={11} y={11} width={6} height={6} />
        </>
    ),
    handshake: () => (
        <>
            <Path d="M3 13 l3 -3 l3 1 l3 -3 l3 3 l3 -1 l3 3" />
            <Path d="M9 11 l3 3 l3 -3" />
        </>
    ),
    sprout: () => (
        <>
            <Path d="M12 19.5 v-8" />
            <Path d="M12 11.5 c-4 0 -6 -2 -6 -5 c3 0 6 2 6 5z" />
            <Path d="M12 11.5 c4 0 6 -3 6 -7 c-3 0 -6 3 -6 7z" />
        </>
    ),
};

export type IconName = keyof typeof PATHS;

export default function Icon({
    name,
    size = 20,
    stroke = "#000",
    fill = "none",
    strokeWidth = 1.6,
}: {
    name: IconName | string;
    size?: number;
    stroke?: string;
    fill?: string;
    strokeWidth?: number;
}) {
    const render = PATHS[name] ?? PATHS.sprout;
    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {render(stroke, fill)}
        </Svg>
    );
}
