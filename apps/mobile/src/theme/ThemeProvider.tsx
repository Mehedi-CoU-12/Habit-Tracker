import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    AccentKey,
    Density,
    Layout,
    Theme,
    makeTheme,
} from "./tokens";
import { KEYS, storage } from "../lib/storage";

type BloomState = {
    theme: Theme;
    dark: boolean;
    accent: AccentKey;
    density: Density;
    layout: Layout;
    setDark: (v: boolean) => void;
    setAccent: (a: AccentKey) => void;
    setDensity: (d: Density) => void;
    setLayout: (l: Layout) => void;
};

const Ctx = createContext<BloomState | null>(null);

type Prefs = {
    dark?: boolean;
    accent?: AccentKey;
    density?: Density;
    layout?: Layout;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [dark, setDarkState] = useState(false);
    const [accent, setAccentState] = useState<AccentKey>("coral");
    const [density, setDensityState] = useState<Density>("cozy");
    const [layout, setLayoutState] = useState<Layout>("garden");

    // hydrate persisted prefs
    useEffect(() => {
        let active = true;
        storage.get(KEYS.prefs).then((raw) => {
            if (!active || !raw) return;
            try {
                const p: Prefs = JSON.parse(raw);
                if (p.dark != null) setDarkState(p.dark);
                if (p.accent) setAccentState(p.accent);
                if (p.density) setDensityState(p.density);
                if (p.layout) setLayoutState(p.layout);
            } catch {
                /* ignore corrupt prefs */
            }
        });
        return () => {
            active = false;
        };
    }, []);

    function persist(next: Prefs) {
        const merged: Prefs = { dark, accent, density, layout, ...next };
        void storage.set(KEYS.prefs, JSON.stringify(merged));
    }

    const value = useMemo<BloomState>(() => {
        const theme = makeTheme(accent, dark, density);
        return {
            theme,
            dark,
            accent,
            density,
            layout,
            setDark: (v) => {
                setDarkState(v);
                persist({ dark: v });
            },
            setAccent: (a) => {
                setAccentState(a);
                persist({ accent: a });
            },
            setDensity: (dn) => {
                setDensityState(dn);
                persist({ density: dn });
            },
            setLayout: (l) => {
                setLayoutState(l);
                persist({ layout: l });
            },
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accent, dark, density, layout]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBloom(): BloomState {
    const v = useContext(Ctx);
    if (!v) throw new Error("useBloom must be used within ThemeProvider");
    return v;
}

/** Convenience: just the resolved theme object. */
export function useTheme(): Theme {
    return useBloom().theme;
}
