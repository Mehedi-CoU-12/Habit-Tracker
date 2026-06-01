"use client";

/** Celebratory 8-dot sparkle burst shown for ~650ms on habit completion. */
export function Sparkles({ show, color }: { show: boolean; color?: string }) {
    if (!show) return null;
    return (
        <div className="pointer-events-none absolute inset-0 overflow-visible">
            {Array.from({ length: 8 }).map((_, i) => {
                const ang = (i / 8) * Math.PI * 2;
                return (
                    <span
                        key={i}
                        className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                        style={{
                            background: color ?? "var(--bloom-accent)",
                            animation: `bloom-spark-${i % 4} .6s ease-out forwards`,
                            transform: `translate(-50%,-50%) rotate(${ang}rad)`,
                        }}
                    />
                );
            })}
        </div>
    );
}

/** Pill toggle switch (46×27) matching the Bloom prototype. */
export function Toggle({
    on,
    onClick,
    label,
}: {
    on: boolean;
    onClick?: () => void;
    label?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            onClick={onClick}
            className="flex h-[27px] w-[46px] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors"
            style={{
                background: on ? "var(--bloom-accent)" : "var(--bloom-line)",
                justifyContent: on ? "flex-end" : "flex-start",
            }}
        >
            <span className="h-[23px] w-[23px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all" />
        </button>
    );
}
