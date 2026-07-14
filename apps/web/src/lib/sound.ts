import { useSyncExternalStore } from "react";

/**
 * BloomSound — the session-sound engine for the focus timer.
 *
 * Every tone is synthesized at runtime with the Web Audio API (no audio files):
 * additive sine partials + a band-passed noise transient, sent through a shared
 * procedural convolver reverb. Each style has a soft `start` tone and a richer
 * `end` tone. See docs: design/focus/SOUND_SYSTEM.md.
 *
 * Module-scope singleton so one AudioContext is reused across the app. The
 * context is created lazily inside play/preview (always user-gesture-driven),
 * which satisfies browser autoplay policies; everything is SSR-guarded.
 */

export type SoundStyleId =
    | "metal_soft"
    | "bell_warm"
    | "wood_tap"
    | "digital_soft"
    | "nature_click";
export type SoundVariant = "start" | "end";

export type SoundPrefs = {
    style: SoundStyleId;
    volume: number; // 0..1 master gain
    on: boolean;
};

const LS_KEY = "bloom-sound-v1";
const DEFAULTS: SoundPrefs = { style: "metal_soft", volume: 0.35, on: true };

// ── Prefs store (useSyncExternalStore-friendly) ─────────────────────────────

let prefs: SoundPrefs = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function isStyleId(v: unknown): v is SoundStyleId {
    return typeof v === "string" && v in STYLES;
}

function load(): void {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
        const p = JSON.parse(
            localStorage.getItem(LS_KEY) ?? "{}",
        ) as Partial<SoundPrefs>;
        prefs = {
            style: isStyleId(p.style) ? p.style : DEFAULTS.style,
            volume:
                typeof p.volume === "number"
                    ? Math.min(1, Math.max(0, p.volume))
                    : DEFAULTS.volume,
            on: typeof p.on === "boolean" ? p.on : DEFAULTS.on,
        };
    } catch {
        /* corrupt prefs → defaults */
    }
}

export function getSoundPrefs(): SoundPrefs {
    load();
    return prefs;
}

export function setSoundPrefs(patch: Partial<SoundPrefs>): void {
    load();
    prefs = { ...prefs, ...patch };
    for (const l of listeners) l();
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    } catch {
        /* storage full/blocked — prefs still apply for this session */
    }
    // Live-adjust the master gain while the volume slider drags.
    if (ctx && master && patch.volume != null) {
        master.gain.setTargetAtTime(prefs.volume, ctx.currentTime, 0.02);
    }
}

/** Reactive prefs for components (server renders with defaults). */
export function useSoundPrefs(): SoundPrefs {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        getSoundPrefs,
        () => DEFAULTS,
    );
}

// ── Audio graph ─────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;

/** Procedural impulse response: exponentially-decaying stereo noise. */
function makeIR(ac: AudioContext, dur: number, decay: number): AudioBuffer {
    const rate = ac.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return buf;
}

function ensure(): boolean {
    if (typeof window === "undefined") return false;
    if (ctx) return true;
    const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = getSoundPrefs().volume;
    master.connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = makeIR(ctx, 2.4, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    reverb.connect(wet);
    wet.connect(master);
    return true;
}

type StrikeCfg = {
    base: number;
    partials: number[];
    gains: number[];
    decay: number;
    attack?: number;
    wet?: number;
    peak?: number;
    noise?: number;
    noiseFreq?: number;
    noiseQ?: number;
    noiseDecay?: number;
};

/** One struck-resonator "hit": additive inharmonic partials + noise transient. */
function strike(t0: number, cfg: StrikeCfg): void {
    if (!ctx || !master || !reverb) return;
    const {
        base,
        partials,
        gains,
        decay,
        attack = 0.004,
        wet = 0.4,
        peak = 0.9,
        noise = 0,
        noiseFreq = 3000,
        noiseQ = 0.8,
        noiseDecay = 0.03,
    } = cfg;
    const ac = ctx;
    const out = ac.createGain();
    out.gain.value = 1;
    out.connect(master);
    const send = ac.createGain();
    send.gain.value = wet;
    out.connect(send);
    send.connect(reverb);

    partials.forEach((mult, i) => {
        const o = ac.createOscillator();
        o.type = "sine";
        o.frequency.value = base * mult;
        const g = ac.createGain();
        const pk = Math.max(0.0002, peak * (gains[i] ?? 0.2));
        const end = t0 + attack + decay;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(pk, t0 + attack);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pk * 0.02), end);
        g.gain.linearRampToValueAtTime(0, end + 0.06); // smooth fade, no click
        o.connect(g);
        g.connect(out);
        o.start(t0);
        o.stop(end + 0.09);
    });

    if (noise > 0) {
        const len = Math.floor(ac.sampleRate * 0.12);
        const nb = ac.createBuffer(1, len, ac.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
        const ns = ac.createBufferSource();
        ns.buffer = nb;
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = noiseFreq;
        bp.Q.value = noiseQ;
        const ng = ac.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.linearRampToValueAtTime(noise, t0 + 0.002);
        ng.gain.exponentialRampToValueAtTime(0.0002, t0 + noiseDecay);
        ns.connect(bp);
        bp.connect(ng);
        ng.connect(out);
        ns.start(t0);
        ns.stop(t0 + 0.12);
    }
}

// ── Sound styles ────────────────────────────────────────────────────────────

export type SoundStyle = {
    id: SoundStyleId;
    name: string;
    tag?: string;
    desc: string;
    icon: string;
};

type StyleDef = Omit<SoundStyle, "id"> & {
    cfg: Omit<StrikeCfg, "decay">;
    play: (this: StyleDef, v: SoundVariant, t0: number) => void;
};

const STYLES: Record<SoundStyleId, StyleDef> = {
    metal_soft: {
        name: "Metal Pipe",
        tag: "Default",
        desc: "Two still pipes, softly kissed — a clean, resonant ting.",
        icon: "target",
        cfg: {
            base: 622,
            partials: [1, 2.76, 5.4, 8.93],
            gains: [1, 0.55, 0.32, 0.18],
            attack: 0.003,
            wet: 0.45,
            noise: 0.22,
            noiseFreq: 3200,
            noiseQ: 0.7,
            noiseDecay: 0.022,
        },
        play(v, t0) {
            const c = this.cfg;
            if (v === "end") {
                strike(t0, { ...c, decay: 1.0 });
                strike(t0 + 0.17, {
                    ...c,
                    base: 588,
                    decay: 1.25,
                    noise: 0.14,
                });
            } else strike(t0, { ...c, decay: 0.5 });
        },
    },
    bell_warm: {
        name: "Soft Bell",
        desc: "A meditation bell — warm, airy, slow to fade.",
        icon: "bell",
        cfg: {
            base: 440,
            partials: [1, 2.0, 2.4, 3.0, 4.5],
            gains: [1, 0.5, 0.4, 0.22, 0.13],
            attack: 0.006,
            wet: 0.6,
            noise: 0.06,
            noiseFreq: 2400,
            noiseDecay: 0.02,
        },
        play(v, t0) {
            const c = this.cfg;
            if (v === "end") strike(t0, { ...c, decay: 1.5, wet: 0.68 });
            else strike(t0, { ...c, decay: 0.7 });
        },
    },
    wood_tap: {
        name: "Wood Tap",
        desc: "A light knock on wood — subtle and grounded.",
        icon: "book",
        cfg: {
            base: 210,
            partials: [1, 3.1, 5.6],
            gains: [0.55, 0.28, 0.12],
            attack: 0.002,
            wet: 0.22,
            noise: 0.5,
            noiseFreq: 950,
            noiseQ: 0.9,
            noiseDecay: 0.018,
        },
        play(v, t0) {
            const c = this.cfg;
            if (v === "end") {
                strike(t0, { ...c, decay: 0.16 });
                strike(t0 + 0.14, {
                    ...c,
                    base: 196,
                    decay: 0.22,
                    noise: 0.38,
                });
            } else strike(t0, { ...c, decay: 0.13 });
        },
    },
    digital_soft: {
        name: "Digital Minimal",
        desc: "A clean sine blip — modern and unobtrusive.",
        icon: "droplet",
        cfg: {
            base: 660,
            partials: [1, 1.5],
            gains: [1, 0.28],
            attack: 0.006,
            wet: 0.25,
            noise: 0,
        },
        play(v, t0) {
            const c = this.cfg;
            if (v === "end") {
                strike(t0, { ...c, decay: 0.45 });
                strike(t0 + 0.16, { ...c, base: 990, decay: 0.7 });
            } else strike(t0, { ...c, decay: 0.32 });
        },
    },
    nature_click: {
        name: "Nature Click",
        desc: "A pebble tap in bamboo — organic and relaxing.",
        icon: "leaf",
        cfg: {
            base: 396,
            partials: [1, 2.3, 4.1],
            gains: [0.5, 0.3, 0.14],
            attack: 0.002,
            wet: 0.4,
            noise: 0.42,
            noiseFreq: 1500,
            noiseQ: 1.1,
            noiseDecay: 0.02,
        },
        play(v, t0) {
            const c = this.cfg;
            if (v === "end") {
                strike(t0, { ...c, decay: 0.2 });
                strike(t0 + 0.15, { ...c, base: 372, decay: 0.4, noise: 0.3 });
            } else strike(t0, { ...c, decay: 0.16 });
        },
    },
};

/** Picker metadata for all styles, in display order. */
export function listSoundStyles(): SoundStyle[] {
    return (Object.keys(STYLES) as SoundStyleId[]).map((id) => ({
        id,
        name: STYLES[id].name,
        tag: STYLES[id].tag,
        desc: STYLES[id].desc,
        icon: STYLES[id].icon,
    }));
}

// ── Playback ────────────────────────────────────────────────────────────────

/** Preview a specific style (always audible — used by the picker). */
export function previewSound(
    style: SoundStyleId,
    variant: SoundVariant = "start",
): void {
    if (!ensure() || !ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const s = STYLES[style] ?? STYLES.metal_soft;
    s.play(variant, ctx.currentTime + 0.03);
}

/** Play the current style (respects the on/off pref) — used by the timer. */
export function playSound(variant: SoundVariant = "start"): void {
    const p = getSoundPrefs();
    if (!p.on) return;
    previewSound(p.style, variant);
}
