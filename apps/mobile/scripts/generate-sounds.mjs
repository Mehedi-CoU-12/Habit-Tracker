import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 22050; // all content sits below ~6 kHz; 22.05 k keeps files small
const OUT_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "assets",
    "sounds",
);

// ---------------------------------------------------------------------------
// Style table — copied verbatim from bloom-sound.jsx STYLES.
// Each play() returns the list of strikes for a variant instead of scheduling
// oscillators: { at, ...cfg } with per-strike overrides applied.
// ---------------------------------------------------------------------------
const STYLES = {
    metal_soft: {
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
        start: (c) => [{ at: 0, ...c, decay: 0.5 }],
        end: (c) => [
            { at: 0, ...c, decay: 1.0 },
            { at: 0.17, ...c, base: 588, decay: 1.25, noise: 0.14 },
        ],
    },
    bell_warm: {
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
        start: (c) => [{ at: 0, ...c, decay: 0.7 }],
        end: (c) => [{ at: 0, ...c, decay: 1.5, wet: 0.68 }],
    },
    wood_tap: {
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
        start: (c) => [{ at: 0, ...c, decay: 0.13 }],
        end: (c) => [
            { at: 0, ...c, decay: 0.16 },
            { at: 0.14, ...c, base: 196, decay: 0.22, noise: 0.38 },
        ],
    },
    digital_soft: {
        cfg: {
            base: 660,
            partials: [1, 1.5],
            gains: [1, 0.28],
            attack: 0.006,
            wet: 0.25,
            noise: 0,
        },
        start: (c) => [{ at: 0, ...c, decay: 0.32 }],
        end: (c) => [
            { at: 0, ...c, decay: 0.45 },
            { at: 0.16, ...c, base: 990, decay: 0.7 },
        ],
    },
    nature_click: {
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
        start: (c) => [{ at: 0, ...c, decay: 0.16 }],
        end: (c) => [
            { at: 0, ...c, decay: 0.2 },
            { at: 0.15, ...c, base: 372, decay: 0.4, noise: 0.3 },
        ],
    },
};

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) so noise/IR — and therefore the files —
// are identical across runs.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------------------
// DSP helpers
// ---------------------------------------------------------------------------

/** Web Audio spec bandpass biquad (constant 0 dB peak gain), in place. */
function bandpass(x, f0, Q) {
    const w0 = (2 * Math.PI * f0) / SAMPLE_RATE;
    const alpha = Math.sin(w0) / (2 * Q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    let x1 = 0,
        x2 = 0,
        y1 = 0,
        y2 = 0;
    for (let i = 0; i < x.length; i++) {
        const y = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x[i];
        y2 = y1;
        y1 = y;
        x[i] = y;
    }
}

/** In-place iterative radix-2 FFT (sign=-1 forward, +1 inverse, unscaled). */
function fft(re, im, sign) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (sign * 2 * Math.PI) / len;
        const wr = Math.cos(ang),
            wi = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let cr = 1,
                ci = 0;
            for (let k = 0; k < len / 2; k++) {
                const ur = re[i + k],
                    ui = im[i + k];
                const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
                const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
                re[i + k] = ur + vr;
                im[i + k] = ui + vi;
                re[i + k + len / 2] = ur - vr;
                im[i + k + len / 2] = ui - vi;
                const ncr = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = ncr;
            }
        }
    }
}

/** Linear convolution of x with kernel h via one big FFT. */
function convolve(x, h) {
    const outLen = x.length + h.length - 1;
    let n = 1;
    while (n < outLen) n <<= 1;
    const xr = new Float64Array(n),
        xi = new Float64Array(n);
    const hr = new Float64Array(n),
        hi = new Float64Array(n);
    xr.set(x);
    hr.set(h);
    fft(xr, xi, -1);
    fft(hr, hi, -1);
    for (let i = 0; i < n; i++) {
        const r = xr[i] * hr[i] - xi[i] * hi[i];
        xi[i] = xr[i] * hi[i] + xi[i] * hr[i];
        xr[i] = r;
    }
    fft(xr, xi, 1);
    const out = new Float64Array(outLen);
    for (let i = 0; i < outLen; i++) out[i] = xr[i] / n;
    return out;
}

// ---------------------------------------------------------------------------
// Reverb impulse response — makeIR(2.4, 2.6) from the prototype, mono, plus
// Blink's ConvolverNode normalization (the web engine leaves normalize=true).
// ---------------------------------------------------------------------------
function makeIR() {
    const rand = mulberry32(0xb100f);
    const len = Math.floor(SAMPLE_RATE * 2.4);
    const ir = new Float64Array(len);
    let power = 0;
    for (let i = 0; i < len; i++) {
        ir[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        power += ir[i] * ir[i];
    }
    const rms = Math.sqrt(power / len);
    // scale = 1/rms · 10^(-58 dB/20) · (44100 / fs) — Chromium's calibration.
    const scale =
        (1 / Math.max(rms, 0.000125)) *
        Math.pow(10, -58 / 20) *
        (44100 / SAMPLE_RATE);
    for (let i = 0; i < len; i++) ir[i] *= scale;
    return ir;
}

// ---------------------------------------------------------------------------
// One struck-resonator hit → adds into `dry` and `send` (pre-reverb) buffers.
// Mirrors strike() in bloom-sound.jsx sample by sample.
// ---------------------------------------------------------------------------
function renderStrike(dry, send, strike, rand) {
    const {
        at,
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
    } = strike;
    const t0 = Math.round(at * SAMPLE_RATE);

    // additive sine partials
    for (let p = 0; p < partials.length; p++) {
        const freq = base * partials[p];
        const pk = Math.max(0.0002, peak * (gains[p] ?? 0.2));
        const nAttack = Math.round(attack * SAMPLE_RATE);
        const nDecay = Math.round(decay * SAMPLE_RATE);
        const nFade = Math.round(0.06 * SAMPLE_RATE);
        const total = nAttack + nDecay + nFade;
        const expEnd = Math.max(0.0002, pk * 0.02);
        const w = (2 * Math.PI * freq) / SAMPLE_RATE;
        for (let i = 0; i < total; i++) {
            let env;
            if (i < nAttack) {
                env = 0.0001 + (pk - 0.0001) * (i / nAttack);
            } else if (i < nAttack + nDecay) {
                env = pk * Math.pow(expEnd / pk, (i - nAttack) / nDecay);
            } else {
                env = expEnd * (1 - (i - nAttack - nDecay) / nFade);
            }
            const s = Math.sin(w * i) * env;
            const idx = t0 + i;
            dry[idx] += s;
            send[idx] += s * wet;
        }
    }

    // band-passed noise transient
    if (noise > 0) {
        const len = Math.floor(SAMPLE_RATE * 0.12);
        const buf = new Float64Array(len);
        for (let i = 0; i < len; i++) buf[i] = rand() * 2 - 1;
        bandpass(buf, noiseFreq, noiseQ);
        const nRamp = Math.round(0.002 * SAMPLE_RATE);
        const nDecay = Math.round(noiseDecay * SAMPLE_RATE);
        for (let i = 0; i < len; i++) {
            let env;
            if (i < nRamp) {
                env = 0.0001 + (noise - 0.0001) * (i / nRamp);
            } else if (i < nDecay) {
                env =
                    noise *
                    Math.pow(0.0002 / noise, (i - nRamp) / (nDecay - nRamp));
            } else {
                env = 0.0002; // Web Audio holds the last ramp target until the source stops
            }
            const s = buf[i] * env;
            const idx = t0 + i;
            dry[idx] += s;
            send[idx] += s * wet;
        }
    }
}

function renderTone(strikes, ir, seed) {
    const rand = mulberry32(seed);
    // hit tail = attack + decay + 60 ms fade (+ oscillator margin); noise is 120 ms
    const hitEnd = Math.max(
        ...strikes.map((s) => s.at + (s.attack ?? 0.004) + s.decay + 0.09),
        ...strikes.map((s) => s.at + 0.12),
    );
    const dryLen = Math.ceil((hitEnd + 0.02) * SAMPLE_RATE);
    const dry = new Float64Array(dryLen);
    const send = new Float64Array(dryLen);
    for (const s of strikes) renderStrike(dry, send, s, rand);

    const wet = convolve(send, ir);
    const out = new Float64Array(wet.length);
    for (let i = 0; i < out.length; i++) {
        out[i] = (i < dryLen ? dry[i] : 0) + wet[i] * 0.5; // reverb wet-gain 0.5
    }
    return out;
}

/** Trim trailing near-silence (keeping 60 ms) and fade the last 15 ms. */
function trim(x, threshold) {
    let last = x.length - 1;
    while (last > 0 && Math.abs(x[last]) < threshold) last--;
    const len = Math.min(x.length, last + Math.round(0.06 * SAMPLE_RATE));
    const out = x.subarray(0, len);
    const nFade = Math.min(len, Math.round(0.015 * SAMPLE_RATE));
    for (let i = 0; i < nFade; i++) out[len - nFade + i] *= 1 - i / nFade;
    return out;
}

function writeWav(path, samples) {
    const n = samples.length;
    const buf = Buffer.alloc(44 + n * 2);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + n * 2, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20); // PCM
    buf.writeUInt16LE(1, 22); // mono
    buf.writeUInt32LE(SAMPLE_RATE, 24);
    buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
        const v = Math.max(-1, Math.min(1, samples[i]));
        buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
    }
    writeFileSync(path, buf);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const ir = makeIR();
const rendered = [];
let seed = 1;
for (const [id, style] of Object.entries(STYLES)) {
    for (const variant of ["start", "end"]) {
        const strikes = style[variant](style.cfg);
        rendered.push({ id, variant, data: renderTone(strikes, ir, seed++) });
    }
}

// one shared normalization so inter-style loudness balance survives
const globalPeak = Math.max(
    ...rendered.map(({ data }) =>
        data.reduce((m, v) => Math.max(m, Math.abs(v)), 0),
    ),
);
const gain = 0.891 / globalPeak; // -1 dBFS

mkdirSync(OUT_DIR, { recursive: true });
for (const { id, variant, data } of rendered) {
    for (let i = 0; i < data.length; i++) data[i] *= gain;
    const trimmed = trim(data, 0.0005);
    const path = join(OUT_DIR, `${id}_${variant}.wav`);
    writeWav(path, trimmed);
    const peak = trimmed.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    console.log(
        `${`${id}_${variant}.wav`.padEnd(24)} ${(trimmed.length / SAMPLE_RATE).toFixed(2)}s  peak ${peak.toFixed(3)}  ${(
            (44 + trimmed.length * 2) /
            1024
        ).toFixed(0)} KB`,
    );
}
console.log(`\n→ ${OUT_DIR}`);
