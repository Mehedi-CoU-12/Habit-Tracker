import { plantStage } from "../../src/lib/progress";

/**
 * Plant — the signature Bloom element. A single 100×100 SVG that grows from
 * seed → sprout → leafy stem → blooms at 7, 30 and 100 days as `streak` lengthens. Not done today =>
 * dimmed and tilted (wilted). Colors come from CSS theme vars (via `style`, so
 * they resolve — `var()` does not work in SVG presentation attributes), so the
 * plant tracks dark mode and the active accent automatically.
 */
export default function Plant({
    streak = 0,
    doneToday = false,
    size = 80,
    flowerColor,
}: {
    streak?: number;
    doneToday?: boolean;
    size?: number;
    flowerColor?: string;
}) {
    const stage = plantStage(streak);
    const dim = doneToday ? 1 : 0.5;
    const leaf = { fill: "var(--bloom-green)" };
    const flower = { fill: flowerColor ?? "var(--bloom-accent)" };

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            style={{ display: "block", overflow: "visible" }}
            aria-hidden="true"
        >
            {/* Pot */}
            <path d="M28 78 L72 78 L68 94 L32 94 Z" style={{ fill: "var(--bloom-dirt)" }} />
            <rect
                x="26"
                y="74"
                width="48"
                height="6"
                rx="2"
                opacity={0.85}
                style={{ fill: "var(--bloom-accent-deep)" }}
            />
            <ellipse
                cx="50"
                cy="76"
                rx="22"
                ry="3"
                opacity={0.4}
                style={{ fill: "var(--bloom-pot-shadow)" }}
            />

            {stage === 0 && (
                <ellipse
                    cx="50"
                    cy="74"
                    rx="6"
                    ry="2"
                    style={{ fill: "var(--bloom-pot-shadow)" }}
                />
            )}

            {stage >= 1 && (
                <g
                    style={{
                        opacity: dim,
                        transformOrigin: "50px 76px",
                        transform: doneToday ? "rotate(0deg)" : "rotate(-3deg)",
                        transition: "opacity .3s, transform .3s",
                    }}
                >
                    <path
                        d={
                            stage === 1
                                ? "M50 76 L50 64"
                                : stage === 2
                                  ? "M50 76 L50 50"
                                  : stage === 3
                                    ? "M50 76 L50 36"
                                    : "M50 76 L50 28"
                        }
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        style={{ stroke: "var(--bloom-green-deep)", fill: "none" }}
                    />
                </g>
            )}

            {stage >= 1 && (
                <g style={{ opacity: dim, transition: "opacity .3s" }}>
                    <ellipse cx="44" cy="64" rx="6" ry="3" transform="rotate(-30 44 64)" style={leaf} />
                    <ellipse cx="56" cy="62" rx="6" ry="3" transform="rotate(30 56 62)" style={leaf} />
                </g>
            )}
            {stage >= 2 && (
                <g style={{ opacity: dim }}>
                    <ellipse cx="40" cy="56" rx="8" ry="4" transform="rotate(-25 40 56)" style={leaf} />
                    <ellipse cx="60" cy="54" rx="8" ry="4" transform="rotate(25 60 54)" style={leaf} />
                </g>
            )}
            {stage >= 3 && (
                <g style={{ opacity: dim }}>
                    <ellipse cx="38" cy="44" rx="9" ry="4.5" transform="rotate(-20 38 44)" style={leaf} />
                    <ellipse cx="62" cy="42" rx="9" ry="4.5" transform="rotate(20 62 42)" style={leaf} />
                </g>
            )}
            {stage === 3 && (
                <g style={{ opacity: dim }}>
                    <circle cx="46" cy="35" r="3" style={flower} />
                    <circle cx="50" cy="31" r="3.5" style={flower} />
                    <circle cx="54" cy="35" r="3" style={flower} />
                    <circle cx="50" cy="35" r="2" style={{ fill: "var(--bloom-sun)" }} />
                </g>
            )}
            {stage >= 5 && (
                <g style={{ opacity: dim }}>
                    <circle cx="31" cy="40" r="3" style={flower} />
                    <circle cx="35" cy="37" r="3" style={flower} />
                    <circle cx="33" cy="40" r="1.8" style={{ fill: "var(--bloom-sun)" }} />
                    <circle cx="69" cy="38" r="3" style={flower} />
                    <circle cx="65" cy="35" r="3" style={flower} />
                    <circle cx="67" cy="38" r="1.8" style={{ fill: "var(--bloom-sun)" }} />
                </g>
            )}
            {stage >= 4 && (
                <g style={{ opacity: dim }}>
                    <circle cx="42" cy="28" r="4" style={flower} />
                    <circle cx="50" cy="22" r="5" style={flower} />
                    <circle cx="58" cy="28" r="4" style={flower} />
                    <circle cx="50" cy="34" r="4" style={flower} />
                    <circle cx="50" cy="28" r="3" style={{ fill: "var(--bloom-sun)" }} />
                </g>
            )}
        </svg>
    );
}
