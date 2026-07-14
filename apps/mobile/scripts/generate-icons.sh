#!/usr/bin/env bash
# Regenerates the HabitFlow launcher/splash icon set into ../assets/images.
# The artwork is the stage-4 blooming plant from the Bloom design system
# (see apps/web/components/bloom/Plant.tsx), drawn with ImageMagick MVG
# primitives on the brand cream (#FFF6E8). Requires ImageMagick 7 (`magick`).
#
# Outputs: icon.png (1024, opaque — also the iOS icon), the Android adaptive
# trio (foreground/background/monochrome), splash-icon.png and favicon.png.
#
# Unit space is the plant's original 100x100 viewBox; the art spans
# x 26..74, y 17..94 (center 50,55.5). Each variant maps unit -> px with a
# translate+scale wrapper; the adaptive foreground/monochrome are scaled to
# keep every point inside the launcher mask's safe zone.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$SCRIPT_DIR/../assets/images"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

# Plant draw commands in unit space (colors = HabitFlow light theme).
cat > plant.mvg <<'EOF'
fill "#A87850" path 'M 28,78 L 72,78 L 68,94 L 32,94 Z'
fill-opacity 0.85
fill "#B95826" roundrectangle 26,74 74,80 2,2
fill-opacity 0.4
fill "#3A2A18" ellipse 50,76 22,3 0,360
fill-opacity 1
stroke "#3F7140" stroke-width 2.5 stroke-linecap round fill none line 50,76 50,28
stroke none
fill "#6FA86B"
push graphic-context
translate 44,64 rotate -30 ellipse 0,0 6,3 0,360
pop graphic-context
push graphic-context
translate 56,62 rotate 30 ellipse 0,0 6,3 0,360
pop graphic-context
push graphic-context
translate 40,56 rotate -25 ellipse 0,0 8,4 0,360
pop graphic-context
push graphic-context
translate 60,54 rotate 25 ellipse 0,0 8,4 0,360
pop graphic-context
push graphic-context
translate 38,44 rotate -20 ellipse 0,0 9,4.5 0,360
pop graphic-context
push graphic-context
translate 62,42 rotate 20 ellipse 0,0 9,4.5 0,360
pop graphic-context
fill "#E87842"
circle 42,28 46,28
circle 50,22 55,22
circle 58,28 62,28
circle 50,34 54,34
fill "#F4C95D" circle 50,28 53,28
EOF

# White silhouette for the Android 13+ themed (monochrome) icon.
sed -e 's/#A87850\|#B95826\|#3A2A18\|#3F7140\|#6FA86B\|#E87842\|#F4C95D/#FFFFFF/g' \
    -e 's/fill-opacity 0\.[0-9]*/fill-opacity 1/g' plant.mvg > plant-white.mvg

# wrap SOURCE.mvg with translate TX,TY + scale S -> OUT.mvg
wrap() { # $1=src $2=out $3=tx $4=ty $5=s
    {
        echo "push graphic-context"
        echo "translate $3,$4"
        echo "scale $5,$5"
        cat "$1"
        echo "pop graphic-context"
    } > "$2"
}

# ── icon.png (1024, opaque cream, soft inner disc, plant s=1.05) ─────────────
# unit transform: b = 50 - s*center  ->  px = b*10.24, scale = s*10.24
wrap plant.mvg icon-main.mvg -25.6 -84.74 10.752
magick -size 1024x1024 xc:"#FFF6E8" \
    -draw 'fill "#FCE9C6" circle 512,512 512,942' \
    -draw "$(cat icon-main.mvg)" -depth 8 PNG24:"$OUT/icon.png"

# ── android adaptive foreground (512, transparent, s=0.75 -> safe zone) ─────
wrap plant.mvg fg.mvg 64 42.88 3.84
magick -size 512x512 xc:none -draw "$(cat fg.mvg)" \
    -depth 8 PNG32:"$OUT/android-icon-foreground.png"

# ── android adaptive background (512, solid cream) ──────────────────────────
magick -size 512x512 xc:"#FFF6E8" -depth 8 PNG24:"$OUT/android-icon-background.png"

# ── android monochrome (432, white silhouette, same safe-zone geometry) ─────
wrap plant-white.mvg mono.mvg 54 36.18 3.24
magick -size 432x432 xc:none -draw "$(cat mono.mvg)" \
    -depth 8 PNG32:"$OUT/android-icon-monochrome.png"

# ── splash icon (512, transparent, plant nearly full-frame s=1.15) ──────────
wrap plant.mvg splash.mvg -38.4 -70.78 5.888
magick -size 512x512 xc:none -draw "$(cat splash.mvg)" \
    -depth 8 PNG32:"$OUT/splash-icon.png"

# ── favicon (48, from the main icon) ────────────────────────────────────────
magick "$OUT/icon.png" -resize 48x48 -depth 8 PNG32:"$OUT/favicon.png"

echo "done -> $OUT"
