"use client";

import { useState } from "react";
import { ACCENTS, AccentKey, useBloom } from "../../provider/theme";
import BloomIcon from "./BloomIcon";
import { Toggle } from "./primitives";

/** Navbar popover exposing the Bloom theme controls: accent, dark mode,
 *  density, and Today layout — the same knobs as the prototype Tweaks panel. */
export default function TweaksMenu() {
    const [open, setOpen] = useState(false);
    const { dark, setDark, accent, setAccent, density, setDensity, layout, setLayout } =
        useBloom();

    const Segment = <T extends string>({
        value,
        options,
        onChange,
    }: {
        value: T;
        options: { v: T; label: string }[];
        onChange: (v: T) => void;
    }) => (
        <div className="flex gap-0.5 rounded-lg bg-surface2 p-0.5">
            {options.map((o) => (
                <button
                    key={o.v}
                    onClick={() => onChange(o.v)}
                    className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                        value === o.v
                            ? "bg-surface text-ink shadow-sm"
                            : "text-muted hover:text-ink2"
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Theme tweaks"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink2 transition hover:bg-surface2"
            >
                <BloomIcon name="sparkle" size={17} />
            </button>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-64 rounded-2xl border border-line bg-surface p-4 shadow-(--bloom-card-shadow)">
                        <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">
                            Appearance
                        </div>

                        {/* Accent */}
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-ink">
                                Accent
                            </span>
                            <div className="flex gap-1.5">
                                {(Object.keys(ACCENTS) as AccentKey[]).map(
                                    (k) => (
                                        <button
                                            key={k}
                                            onClick={() => setAccent(k)}
                                            aria-label={ACCENTS[k].name}
                                            className="h-6 w-6 cursor-pointer rounded-full transition"
                                            style={{
                                                background: ACCENTS[k].accent,
                                                outline:
                                                    accent === k
                                                        ? "2.5px solid var(--bloom-ink)"
                                                        : "none",
                                                outlineOffset: 1,
                                            }}
                                        />
                                    ),
                                )}
                            </div>
                        </div>

                        {/* Dark mode */}
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-ink">
                                Dark mode
                            </span>
                            <Toggle
                                on={dark}
                                onClick={() => setDark(!dark)}
                                label="Dark mode"
                            />
                        </div>

                        {/* Density */}
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-ink">
                                Density
                            </span>
                            <Segment
                                value={density}
                                onChange={setDensity}
                                options={[
                                    { v: "cozy", label: "Cozy" },
                                    { v: "compact", label: "Compact" },
                                ]}
                            />
                        </div>

                        {/* Layout */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-ink">
                                Today view
                            </span>
                            <Segment
                                value={layout}
                                onChange={setLayout}
                                options={[
                                    { v: "garden", label: "Garden" },
                                    { v: "list", label: "List" },
                                ]}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
