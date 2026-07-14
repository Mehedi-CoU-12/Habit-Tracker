import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import {
    createAudioPlayer,
    setAudioModeAsync,
    type AudioPlayer,
} from "expo-audio";
import { KEYS, storage } from "../lib/storage";

export type SoundStyleId =
    | "metal_soft"
    | "bell_warm"
    | "wood_tap"
    | "digital_soft"
    | "nature_click";
export type SoundVariant = "start" | "end";

export type SoundPrefs = {
    style: SoundStyleId;
    volume: number; // 0..1, master gain applied at playback
    on: boolean;
};

const DEFAULTS: SoundPrefs = { style: "metal_soft", volume: 0.35, on: true };

export type SoundStyle = {
    id: SoundStyleId;
    name: string;
    tag?: string;
    desc: string;
    icon: string;
};

/** Picker metadata — copy matches the web SoundScreen. */
export const SOUND_STYLES: SoundStyle[] = [
    {
        id: "metal_soft",
        name: "Metal Pipe",
        tag: "Default",
        desc: "Two still pipes, softly kissed — a clean, resonant ting.",
        icon: "target",
    },
    {
        id: "bell_warm",
        name: "Soft Bell",
        desc: "A meditation bell — warm, airy, slow to fade.",
        icon: "bell",
    },
    {
        id: "wood_tap",
        name: "Wood Tap",
        desc: "A light knock on wood — subtle and grounded.",
        icon: "book",
    },
    {
        id: "digital_soft",
        name: "Digital Minimal",
        desc: "A clean sine blip — modern and unobtrusive.",
        icon: "droplet",
    },
    {
        id: "nature_click",
        name: "Nature Click",
        desc: "A pebble tap in bamboo — organic and relaxing.",
        icon: "leaf",
    },
];

// Static require map — Metro needs literal paths to bundle the assets.
const SOURCES: Record<SoundStyleId, Record<SoundVariant, number>> = {
    metal_soft: {
        start: require("../../assets/sounds/metal_soft_start.wav"),
        end: require("../../assets/sounds/metal_soft_end.wav"),
    },
    bell_warm: {
        start: require("../../assets/sounds/bell_warm_start.wav"),
        end: require("../../assets/sounds/bell_warm_end.wav"),
    },
    wood_tap: {
        start: require("../../assets/sounds/wood_tap_start.wav"),
        end: require("../../assets/sounds/wood_tap_end.wav"),
    },
    digital_soft: {
        start: require("../../assets/sounds/digital_soft_start.wav"),
        end: require("../../assets/sounds/digital_soft_end.wav"),
    },
    nature_click: {
        start: require("../../assets/sounds/nature_click_start.wav"),
        end: require("../../assets/sounds/nature_click_end.wav"),
    },
};

// ── Prefs store (useSyncExternalStore-friendly, like offline/hooks) ─────────

let prefs: SoundPrefs = { ...DEFAULTS };
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
    for (const l of listeners) l();
}

function isStyleId(v: unknown): v is SoundStyleId {
    return SOUND_STYLES.some((s) => s.id === v);
}

/** Load persisted prefs once; safe to call repeatedly. */
export function hydrateSoundPrefs(): Promise<void> {
    if (!hydrating) {
        hydrating = storage.get(KEYS.sound).then((raw) => {
            if (!raw) return;
            try {
                const p = JSON.parse(raw) as Partial<SoundPrefs>;
                prefs = {
                    style: isStyleId(p.style) ? p.style : prefs.style,
                    volume:
                        typeof p.volume === "number"
                            ? Math.min(1, Math.max(0, p.volume))
                            : prefs.volume,
                    on: typeof p.on === "boolean" ? p.on : prefs.on,
                };
                emit();
            } catch {
                /* ignore corrupt prefs */
            }
        });
    }
    return hydrating;
}

export function getSoundPrefs(): SoundPrefs {
    return prefs;
}

export function setSoundPrefs(patch: Partial<SoundPrefs>): void {
    prefs = { ...prefs, ...patch };
    emit();
    void storage.set(KEYS.sound, JSON.stringify(prefs));
}

/** Reactive prefs for screens (kicks off hydration on first use). */
export function useSoundPrefs(): SoundPrefs {
    void hydrateSoundPrefs();
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        getSoundPrefs,
        getSoundPrefs,
    );
}

// ── Playback ────────────────────────────────────────────────────────────────

let audioModeSet = false;
const players = new Map<string, AudioPlayer>();

function ensureAudioMode(): void {
    if (audioModeSet) return;
    audioModeSet = true;
    // Short UI tones: mix with (don't pause) whatever the user is listening
    // to, and ring through the iOS silent switch like a meditation bell.
    void setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "mixWithOthers",
    }).catch(() => {});
}

/** Preview a specific style (always audible — used by the picker). */
export function previewSound(
    style: SoundStyleId,
    variant: SoundVariant = "start",
): void {
    if (Platform.OS === "web") return; // demo parity lives in the web app
    ensureAudioMode();
    try {
        const key = `${style}_${variant}`;
        let player = players.get(key);
        if (!player) {
            player = createAudioPlayer(SOURCES[style][variant]);
            players.set(key, player);
        }
        player.volume = prefs.volume;
        // Rewind (also resets a finished player), then fire.
        const p = player;
        p.seekTo(0).then(
            () => p.play(),
            () => p.play(),
        );
    } catch {
        // Audio is best-effort — a missing native module (e.g. Expo Go
        // without a rebuild) must never crash the timer.
    }
}

/** Play the current style (respects the on/off pref) — used by the timer. */
export function playSound(variant: SoundVariant = "start"): void {
    if (!prefs.on) return;
    previewSound(prefs.style, variant);
}
