import { memo, useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { HeatDay, HeatGrid } from "../lib/heatmap";
import { dayNames, dayNamesFull, monthShort } from "../lib/date";

/** Per-layout pitch. `gutter` is the left axis reserved for row labels. */
const GEOM = {
    row: { gap: 8, gutter: 0, maxCell: 54 },
    calendar: { gap: 6, gutter: 0, maxCell: 64 },
    months: { gap: 1.5, gutter: 26, maxCell: 20 },
} as const;

const LEVEL_SWATCHES = [0, 1, 2, 3, 4];

/** Breathing room so the today/selected rings aren't clipped by the SVG edge. */
const PAD = 1.5;

function cellKey(row: number, col: number): string {
    return `${row}:${col}`;
}

/**
 * Day grid for a Week / Month / Year heatmap. Cells arrive laid out from
 * `lib/heatmap`; this turns (col, row) into pixels once the container width is
 * measured — the same pitch drives the SVG rects and the RN text axes, so
 * labels stay glued to their columns at any width.
 *
 * Tapping goes through one Pressable over the whole grid rather than per-rect
 * handlers: it keeps every hit area a full pitch wide (the year's cells are
 * ~8px) and avoids mounting a touch responder per day.
 */
function Heatmap({
    grid,
    legend = ["Less", "More"],
    caption,
}: {
    grid: HeatGrid;
    /** Captions bracketing the intensity ramp. */
    legend?: [string, string];
    /** Readout text shown while no cell is selected. */
    caption?: string;
}) {
    const th = useTheme();
    const [width, setWidth] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);

    const { gap, gutter, maxCell } = GEOM[grid.layout];
    const cell = Math.min(
        maxCell,
        Math.max(
            2,
            (width - PAD * 2 - gutter - gap * (grid.cols - 1)) /
                Math.max(1, grid.cols),
        ),
    );
    const pitch = cell + gap;
    const gridW = gutter + grid.cols * pitch - gap + PAD * 2;
    const gridH = grid.rows * pitch - gap + PAD * 2;

    const byCell = useMemo(() => {
        const m = new Map<string, HeatDay>();
        for (const d of grid.days) m.set(cellKey(d.row, d.col), d);
        return m;
    }, [grid]);

    // Selection is keyed on the day index so it survives a data refresh; a
    // period switch drops it, since the day may not be on the new grid at all.
    const active = useMemo(
        () =>
            selected === null
                ? null
                : (grid.days.find((d) => d.index === selected) ?? null),
        [grid, selected],
    );

    const onLayout = (e: LayoutChangeEvent) =>
        setWidth(e.nativeEvent.layout.width);

    const onPress = (x: number, y: number) => {
        const col = Math.floor((x - PAD - gutter) / pitch);
        const row = Math.floor((y - PAD) / pitch);
        const hit = byCell.get(cellKey(row, col));
        setSelected(
            hit && hit.index === selected ? null : (hit?.index ?? null),
        );
    };

    // An empty slot must sit *above* the card in dark and *below* it in light,
    // so the two themes can't share a token: surface2 is darker than the card's
    // surface in dark mode, which made missed days vanish into it.
    const empty = th.dark ? "rgba(255,255,255,0.10)" : th.surface2;
    const ghost = th.dark ? "rgba(255,255,255,0.035)" : th.surface2;

    const cellFill = (level: number, faded: boolean) =>
        faded ? ghost : level === 0 ? empty : th.green;
    const cellOpacity = (level: number, faded: boolean) => {
        // Future and pre-planting days barely register: they aren't misses.
        if (faded) return th.dark ? 1 : 0.24;
        if (level === 0) return th.dark ? 1 : 0.55;
        // Dark needs a higher floor — low-opacity green muddies into the card.
        return th.dark
            ? Math.min(1, 0.52 + level * 0.12)
            : Math.min(1, 0.4 + level * 0.16);
    };

    const fadedFor = (d: HeatDay) => d.future || d.dormant;

    const label = { fontSize: 9.5, color: th.muted, fontFamily: th.sansBold };

    if (width === 0) return <View onLayout={onLayout} style={{ height: 1 }} />;

    return (
        <View onLayout={onLayout}>
            {grid.layout === "row" && (
                <View
                    style={{
                        flexDirection: "row",
                        marginBottom: 6,
                        paddingLeft: PAD,
                    }}
                >
                    {grid.days.map((d) => (
                        <Text
                            key={d.index}
                            style={[
                                label,
                                {
                                    width: cell,
                                    marginRight: gap,
                                    textAlign: "center",
                                    color: d.today ? th.accent : th.muted,
                                },
                            ]}
                        >
                            {dayNames[d.weekday]}
                        </Text>
                    ))}
                </View>
            )}

            {grid.layout === "calendar" && (
                <View
                    style={{
                        flexDirection: "row",
                        marginBottom: 6,
                        paddingLeft: PAD,
                    }}
                >
                    {dayNames.map((n, i) => (
                        <Text
                            key={i}
                            style={[
                                label,
                                {
                                    width: cell,
                                    marginRight: gap,
                                    textAlign: "center",
                                },
                            ]}
                        >
                            {n}
                        </Text>
                    ))}
                </View>
            )}

            <Pressable
                onPress={(e) =>
                    onPress(e.nativeEvent.locationX, e.nativeEvent.locationY)
                }
                style={{ height: gridH }}
            >
                {grid.layout === "months" &&
                    grid.rowLabels.map((r) => (
                        <Text
                            key={r.row}
                            style={[
                                label,
                                {
                                    position: "absolute",
                                    left: 0,
                                    width: gutter - 6,
                                    top: PAD + r.row * pitch,
                                    height: cell,
                                    lineHeight: cell,
                                    textAlign: "right",
                                },
                            ]}
                        >
                            {r.label}
                        </Text>
                    ))}

                <Svg width={gridW} height={gridH}>
                    {grid.days.map((d) => (
                        <Rect
                            key={d.index}
                            x={PAD + gutter + d.col * pitch}
                            y={PAD + d.row * pitch}
                            width={cell}
                            height={cell}
                            rx={Math.min(4, cell * 0.28)}
                            fill={cellFill(d.level, fadedFor(d))}
                            opacity={cellOpacity(d.level, fadedFor(d))}
                        />
                    ))}
                    {/* Forgiven days get an accent outline over the empty
                        fill rather than a level of their own: level 1 is
                        already the partial shade, and a skip is not progress.
                        Hollow reads as "this day was let go", which is what
                        happened. */}
                    {grid.days
                        .filter((d) => d.skipped && !fadedFor(d))
                        .map((d) => (
                            <Rect
                                key={`skip-${d.index}`}
                                x={PAD + gutter + d.col * pitch + 0.8}
                                y={PAD + d.row * pitch + 0.8}
                                width={cell - 1.6}
                                height={cell - 1.6}
                                rx={Math.min(4, cell * 0.28)}
                                fill="none"
                                stroke={th.accent}
                                strokeWidth={1.4}
                                strokeDasharray="2 1.6"
                            />
                        ))}
                    {/* Rings ride above every fill so a neighbour can't clip them. */}
                    {grid.days
                        .filter((d) => d.today || d.index === active?.index)
                        .map((d) => (
                            <Rect
                                key={`ring-${d.index}`}
                                x={PAD + gutter + d.col * pitch - 1}
                                y={PAD + d.row * pitch - 1}
                                width={cell + 2}
                                height={cell + 2}
                                rx={Math.min(5, cell * 0.28 + 1)}
                                fill="none"
                                stroke={
                                    d.index === active?.index
                                        ? th.ink
                                        : th.accent
                                }
                                strokeWidth={1.6}
                            />
                        ))}
                </Svg>
            </Pressable>

            {grid.layout === "row" && (
                <View
                    style={{
                        flexDirection: "row",
                        marginTop: 6,
                        paddingLeft: PAD,
                    }}
                >
                    {grid.days.map((d) => (
                        <Text
                            key={d.index}
                            style={[
                                label,
                                {
                                    width: cell,
                                    marginRight: gap,
                                    textAlign: "center",
                                    color: d.today ? th.accent : th.ink2,
                                },
                            ]}
                        >
                            {d.day}
                        </Text>
                    ))}
                </View>
            )}

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 12,
                    gap: 8,
                }}
            >
                <Text
                    style={{
                        flex: 1,
                        fontSize: 11.5,
                        color: active ? th.ink : th.muted,
                        fontFamily: active ? th.sansBold : th.sans,
                    }}
                    numberOfLines={1}
                >
                    {active ? readout(active) : (caption ?? "")}
                </Text>
                <Text style={label}>{legend[0]}</Text>
                <View style={{ flexDirection: "row", gap: 3 }}>
                    {LEVEL_SWATCHES.map((l) => (
                        <View
                            key={l}
                            style={{
                                width: 9,
                                height: 9,
                                borderRadius: 2.5,
                                backgroundColor: cellFill(l, false),
                                opacity: cellOpacity(l, false),
                            }}
                        />
                    ))}
                </View>
                <Text style={label}>{legend[1]}</Text>
            </View>
        </View>
    );
}

function readout(d: HeatDay): string {
    const when = `${dayNamesFull[d.weekday]}, ${monthShort[d.month - 1]} ${d.day}`;
    if (d.future) return `${when} · upcoming`;
    if (d.dormant) return `${when} · not tracked yet`;
    return `${when} · ${d.detail ?? (d.done ? "done" : "missed")}`;
}

export default memo(Heatmap);
