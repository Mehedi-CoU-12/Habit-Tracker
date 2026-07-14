"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BloomIcon from "../../../components/bloom/BloomIcon";
import { Toggle } from "../../../components/bloom/primitives";
import {
    listSoundStyles,
    previewSound,
    setSoundPrefs,
    useSoundPrefs,
    SoundStyleId,
    SoundVariant,
} from "../../../src/lib/sound";

/**
 * Session-sound picker for the focus timer: master on/off + volume, then one
 * card per synthesized style with Start/End preview buttons. Tapping a card
 * selects the style and plays its end tone. Spec: design/focus/SOUND_SYSTEM.md.
 */
export default function SoundPage() {
    const prefs = useSoundPrefs();
    const [pulse, setPulse] = useState<string | null>(null); // `${id}-${variant}`
    const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const styles = listSoundStyles();

    useEffect(
        () => () => {
            if (pulseTimer.current) clearTimeout(pulseTimer.current);
        },
        [],
    );

    const preview = (id: SoundStyleId, variant: SoundVariant) => {
        previewSound(id, variant);
        setPulse(`${id}-${variant}`);
        if (pulseTimer.current) clearTimeout(pulseTimer.current);
        pulseTimer.current = setTimeout(() => setPulse(null), 420);
    };

    const select = (id: SoundStyleId) => {
        setSoundPrefs({ style: id });
        preview(id, "end");
    };

    const MiniBtn = ({
        id,
        variant,
        label,
    }: {
        id: SoundStyleId;
        variant: SoundVariant;
        label: string;
    }) => {
        const active = pulse === `${id}-${variant}`;
        return (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    preview(id, variant);
                }}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[11.5px] font-bold transition"
                style={{
                    borderColor: active
                        ? "var(--bloom-accent)"
                        : "var(--bloom-line)",
                    background: active
                        ? "color-mix(in srgb, var(--bloom-accent) 14%, transparent)"
                        : "var(--bloom-surface)",
                    color: active
                        ? "var(--bloom-accent-deep)"
                        : "var(--bloom-ink2)",
                }}
            >
                <BloomIcon name="play2" size={11} />
                {label}
            </button>
        );
    };

    return (
        <div className="relative min-h-screen bg-bg">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40"
                style={{
                    background:
                        "linear-gradient(180deg, color-mix(in srgb, var(--bloom-accent) 16%, transparent) 0%, var(--bloom-bg) 100%)",
                }}
            />

            <div className="relative mx-auto w-full max-w-md px-5 pb-10 pt-5">
                {/* top bar */}
                <div className="flex items-center justify-between">
                    <Link
                        href="/focus"
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-surface transition hover:bg-surface2"
                        title="Back to timer"
                    >
                        <BloomIcon name="chevronLeft" size={18} />
                    </Link>
                    <span className="text-[13px] font-bold tracking-[0.08em] text-muted">
                        SOUND
                    </span>
                    <span className="w-10" />
                </div>

                <div className="mt-3">
                    <h1 className="font-display text-[34px] leading-tight text-ink">
                        Session sounds
                    </h1>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink2">
                        A gentle nudge at the start and end of each focus
                        session.
                    </p>
                </div>

                {/* master card: toggle + volume */}
                <div className="mt-4 rounded-bloom border-[1.5px] border-line bg-surface p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="grid h-10 w-10 place-items-center rounded-xl"
                                style={{
                                    background: prefs.on
                                        ? "color-mix(in srgb, var(--bloom-accent) 16%, transparent)"
                                        : "var(--bloom-surface2)",
                                    color: prefs.on
                                        ? "var(--bloom-accent)"
                                        : "var(--bloom-muted)",
                                }}
                            >
                                <BloomIcon
                                    name={prefs.on ? "volume" : "volumeOff"}
                                    size={20}
                                    strokeWidth={1.8}
                                />
                            </div>
                            <div>
                                <p className="text-[15px] font-bold text-ink">
                                    Sounds
                                </p>
                                <p className="text-xs text-muted">
                                    {prefs.on ? "On" : "Off"}
                                </p>
                            </div>
                        </div>
                        <Toggle
                            on={prefs.on}
                            label="Session sounds"
                            onClick={() => setSoundPrefs({ on: !prefs.on })}
                        />
                    </div>

                    <div
                        className="mt-4 flex items-center gap-3"
                        style={{
                            opacity: prefs.on ? 1 : 0.4,
                            pointerEvents: prefs.on ? "auto" : "none",
                        }}
                    >
                        <BloomIcon
                            name="volumeOff"
                            size={16}
                            className="text-muted"
                        />
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={prefs.volume}
                            aria-label="Volume"
                            onChange={(e) =>
                                setSoundPrefs({
                                    volume: parseFloat(e.target.value),
                                })
                            }
                            onPointerUp={() =>
                                previewSound(prefs.style, "start")
                            }
                            className="h-1 flex-1 cursor-pointer"
                            style={{ accentColor: "var(--bloom-accent)" }}
                        />
                        <BloomIcon
                            name="volume"
                            size={18}
                            className="text-ink2"
                        />
                    </div>
                </div>

                {/* sound list */}
                <div className="mt-5" style={{ opacity: prefs.on ? 1 : 0.5 }}>
                    <p className="mb-2.5 text-[11px] font-bold tracking-[0.1em] text-muted">
                        CHOOSE A SOUND
                    </p>
                    <div className="flex flex-col gap-2.5">
                        {styles.map((s) => {
                            const on = prefs.style === s.id;
                            return (
                                <div
                                    key={s.id}
                                    onClick={() => select(s.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                        ) {
                                            e.preventDefault();
                                            select(s.id);
                                        }
                                    }}
                                    className="cursor-pointer rounded-[20px] border-[1.5px] bg-surface p-4 transition-[border-color,box-shadow] duration-200"
                                    style={{
                                        borderColor: on
                                            ? "var(--bloom-accent)"
                                            : "var(--bloom-line)",
                                        boxShadow: on
                                            ? "0 6px 18px color-mix(in srgb, var(--bloom-accent) 16%, transparent)"
                                            : "none",
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px]"
                                            style={{
                                                background: on
                                                    ? "var(--bloom-accent)"
                                                    : "var(--bloom-surface2)",
                                                color: on
                                                    ? "#fff"
                                                    : "var(--bloom-ink2)",
                                            }}
                                        >
                                            <BloomIcon
                                                name={s.icon}
                                                size={20}
                                                strokeWidth={1.8}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="whitespace-nowrap text-[15.5px] font-bold text-ink">
                                                    {s.name}
                                                </span>
                                                {s.tag && (
                                                    <span
                                                        className="rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wide"
                                                        style={{
                                                            color: "var(--bloom-accent-deep)",
                                                            background:
                                                                "color-mix(in srgb, var(--bloom-accent) 16%, transparent)",
                                                        }}
                                                    >
                                                        {s.tag.toUpperCase()}
                                                    </span>
                                                )}
                                                {on && (
                                                    <span className="ml-auto grid h-[22px] w-[22px] place-items-center rounded-full bg-accent">
                                                        <BloomIcon
                                                            name="check"
                                                            size={12}
                                                            stroke="#fff"
                                                            strokeWidth={2.6}
                                                        />
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-[12.5px] leading-snug text-ink2">
                                                {s.desc}
                                            </p>
                                            <div className="mt-3 flex gap-2">
                                                <MiniBtn
                                                    id={s.id}
                                                    variant="start"
                                                    label="Start"
                                                />
                                                <MiniBtn
                                                    id={s.id}
                                                    variant="end"
                                                    label="End"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <p className="mt-4 text-center font-display text-xs italic text-muted">
                        Tap a card to preview and set it. ❀
                    </p>
                </div>
            </div>
        </div>
    );
}
