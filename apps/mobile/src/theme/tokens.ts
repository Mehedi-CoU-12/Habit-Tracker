/**
 * Bloom theme tokens — ported from the web prototype's bloom-core.jsx.
 * Pure data: makeTheme(accent, dark, density) returns a flat object of hex
 * colors + density-driven spacing used directly in RN StyleSheets.
 */

export type AccentKey = "coral" | "fern" | "sky" | "berry";
export type Density = "cozy" | "compact";
export type Layout = "garden" | "list";

export const ACCENTS: Record<
    AccentKey,
    { accent: string; soft: string; deep: string; name: string }
> = {
    coral: {
        accent: "#E87842",
        soft: "#FBC9A8",
        deep: "#B95826",
        name: "Coral",
    },
    fern: { accent: "#5DA45A", soft: "#C2E2BC", deep: "#3A6E39", name: "Fern" },
    sky: { accent: "#4E92CE", soft: "#BCD8EF", deep: "#2C6499", name: "Sky" },
    berry: {
        accent: "#D2618E",
        soft: "#F2BFD3",
        deep: "#9C3A64",
        name: "Berry",
    },
};

export function hexA(hex: string, a: number): string {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

export type Theme = ReturnType<typeof makeTheme>;

export function makeTheme(
    accentKey: AccentKey = "coral",
    dark = false,
    density: Density = "cozy",
) {
    const a = ACCENTS[accentKey] ?? ACCENTS.coral;
    const base = dark
        ? {
              bg: "#181310",
              surface: "#241C15",
              surface2: "#30251A",
              line: "#3C2E1F",
              ink: "#F6ECDD",
              ink2: "#CBB89E",
              muted: "#8C7A62",
              sun: "#E6B85C",
              sky: "#6FA0CC",
              green: "#6FB86A",
              greenSoft: "rgba(111,184,106,0.18)",
              greenDeep: "#4E8C4A",
              dirt: "#6E5236",
              overlay: "rgba(0,0,0,0.6)",
              potShadow: "#0E0A06",
          }
        : {
              bg: "#FFF6E8",
              surface: "#FFFDF7",
              surface2: "#FCE9C6",
              line: "#F0D9B0",
              ink: "#2A1F14",
              ink2: "#5C4A33",
              muted: "#A89373",
              sun: "#F4C95D",
              sky: "#8FB5D4",
              green: "#6FA86B",
              greenSoft: "rgba(111,168,107,0.22)",
              greenDeep: "#3F7140",
              dirt: "#A87850",
              overlay: "rgba(42,31,20,0.45)",
              potShadow: "#3A2A18",
          };

    const accentSoftBg = dark ? hexA(a.accent, 0.18) : a.soft;

    const d =
        density === "compact"
            ? {
                  gap: 8,
                  pad: 16,
                  cardPad: 12,
                  rowPad: 10,
                  radius: 16,
                  font: 0.92,
                  plant: 0.88,
              }
            : {
                  gap: 12,
                  pad: 22,
                  cardPad: 16,
                  rowPad: 12,
                  radius: 22,
                  font: 1,
                  plant: 1,
              };

    return {
        ...base,
        accent: a.accent,
        soft: a.soft,
        deep: a.deep,
        accentKey,
        dark,
        density,
        accentSoftBg,
        d,
        // RN font families (loaded in _layout via expo-google-fonts)
        display: "Caprasimo_400Regular",
        sans: "Manrope_500Medium",
        sansBold: "Manrope_700Bold",
        mono: "JetBrainsMono_500Medium",
    };
}
