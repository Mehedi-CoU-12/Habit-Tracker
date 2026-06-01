"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type AccentKey = "coral" | "fern" | "sky" | "berry";
export type Density = "cozy" | "compact";
export type Layout = "garden" | "list";
type Mode = "light" | "dark";

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

/**
 * Concrete neutral hex values mirroring the CSS tokens in globals.css.
 * Needed by libraries (recharts) that render colors as SVG presentation
 * attributes, where `var()` does not resolve.
 */
export const NEUTRALS = {
    light: {
        surface: "#FFFDF7",
        surface2: "#FCE9C6",
        line: "#F0D9B0",
        ink: "#2A1F14",
        ink2: "#5C4A33",
        muted: "#A89373",
        green: "#6FA86B",
        greenDeep: "#3F7140",
        sun: "#F4C95D",
        sky: "#8FB5D4",
    },
    dark: {
        surface: "#241C15",
        surface2: "#30251A",
        line: "#3C2E1F",
        ink: "#F6ECDD",
        ink2: "#CBB89E",
        muted: "#8C7A62",
        green: "#6FB86A",
        greenDeep: "#4E8C4A",
        sun: "#E6B85C",
        sky: "#6FA0CC",
    },
} as const;

type BloomState = {
    /* legacy dark-mode api (kept so existing imports keep working) */
    theme: Mode;
    toggle: () => void;
    /* full bloom controls */
    dark: boolean;
    setDark: (v: boolean) => void;
    accent: AccentKey;
    setAccent: (a: AccentKey) => void;
    density: Density;
    setDensity: (d: Density) => void;
    layout: Layout;
    setLayout: (l: Layout) => void;
};

const BloomContext = createContext<BloomState>({
    theme: "light",
    toggle: () => {},
    dark: false,
    setDark: () => {},
    accent: "coral",
    setAccent: () => {},
    density: "cozy",
    setDensity: () => {},
    layout: "garden",
    setLayout: () => {},
});

const LS_KEY = "bloom-prefs-v1";

function readSaved() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
    } catch {
        return {};
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [dark, setDarkState] = useState(false);
    const [accent, setAccentState] = useState<AccentKey>("coral");
    const [density, setDensityState] = useState<Density>("cozy");
    const [layout, setLayoutState] = useState<Layout>("garden");

    // hydrate from storage (or legacy "theme" key) on mount
    useEffect(() => {
        const saved = readSaved();
        const legacyDark = localStorage.getItem("theme");
        const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)",
        ).matches;

        const initialDark: boolean =
            saved.dark ?? (legacyDark ? legacyDark === "dark" : prefersDark);
        const initialAccent: AccentKey = saved.accent ?? "coral";
        const initialDensity: Density = saved.density ?? "cozy";
        const initialLayout: Layout = saved.layout ?? "garden";

        setDarkState(initialDark);
        setAccentState(initialAccent);
        setDensityState(initialDensity);
        setLayoutState(initialLayout);

        const root = document.documentElement;
        root.classList.toggle("dark", initialDark);
        root.setAttribute("data-accent", initialAccent);
        root.setAttribute("data-density", initialDensity);
    }, []);

    function persist(
        next: Partial<{
            dark: boolean;
            accent: AccentKey;
            density: Density;
            layout: Layout;
        }>,
    ) {
        const merged = { dark, accent, density, layout, ...next };
        localStorage.setItem(LS_KEY, JSON.stringify(merged));
    }

    function setDark(v: boolean) {
        setDarkState(v);
        document.documentElement.classList.toggle("dark", v);
        localStorage.setItem("theme", v ? "dark" : "light"); // legacy mirror
        persist({ dark: v });
    }
    function setAccent(a: AccentKey) {
        setAccentState(a);
        document.documentElement.setAttribute("data-accent", a);
        persist({ accent: a });
    }
    function setDensity(d: Density) {
        setDensityState(d);
        document.documentElement.setAttribute("data-density", d);
        persist({ density: d });
    }
    function setLayout(l: Layout) {
        setLayoutState(l);
        persist({ layout: l });
    }

    return (
        <BloomContext.Provider
            value={{
                theme: dark ? "dark" : "light",
                toggle: () => setDark(!dark),
                dark,
                setDark,
                accent,
                setAccent,
                density,
                setDensity,
                layout,
                setLayout,
            }}
        >
            {children}
        </BloomContext.Provider>
    );
}

/** Legacy hook — { theme, toggle } for dark mode. */
export function useTheme() {
    const { theme, toggle } = useContext(BloomContext);
    return { theme, toggle };
}

/** Full Bloom theme controls. */
export function useBloom() {
    return useContext(BloomContext);
}
