import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { HEATMAP_WEEKS, HeatCell } from "../lib/date";

const CELL = 12; // grid pitch
const SIZE = 10; // rendered square

/**
 * GitHub-style contribution grid for the ~6-month heatmap. Columns are weeks
 * (oldest → newest), rows are weekdays. Cells come pre-computed from
 * `buildActivityCells` / `buildHabitCells`; `level` 0 renders faint, 1–4 fill
 * with progressively stronger green.
 */
export default function Heatmap({
    cells,
    height = 90,
}: {
    cells: HeatCell[];
    height?: number;
}) {
    const th = useTheme();
    return (
        <Svg
            viewBox={`0 0 ${HEATMAP_WEEKS * CELL} 90`}
            width="100%"
            height={height}
        >
            {cells.map((c) => (
                <Rect
                    key={`${c.week}-${c.day}`}
                    x={c.week * CELL}
                    y={c.day * CELL}
                    width={SIZE}
                    height={SIZE}
                    rx={3}
                    fill={c.level === 0 ? th.surface2 : th.green}
                    opacity={
                        c.level === 0
                            ? th.dark
                                ? 0.4
                                : 0.5
                            : Math.min(1, 0.4 + c.level * 0.16)
                    }
                />
            ))}
        </Svg>
    );
}
