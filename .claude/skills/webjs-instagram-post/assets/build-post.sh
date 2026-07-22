#!/usr/bin/env bash
#
# Build one on-theme WebJs Instagram post image that matches the webjs.dev OG
# cards: near-black background, a soft warm glow in the top-right corner, the
# orange squircle mark plus the white "webjs" wordmark, a bold white headline
# with one orange-highlighted phrase, gray subtext, and a small-caps footer
# meta row with a "webjs.dev" URL.
#
# Sharpness: the whole card is rendered at SS x supersample (default 2, so a
# 2160px canvas) and downscaled with Lanczos + a light unsharp to the final
# size. This keeps the logo and text crisp in Instagram's DESKTOP full-size
# view (a flat 1080 render looks soft there on a high-DPI screen after IG
# re-compresses it). Output defaults to 1440x1440 at JPEG quality 95.
#
# Override the copy per post via env vars (all optional):
#   HEADLINE  pango markup, wrap the key phrase in <span foreground="#F0803A">
#   SUBTEXT   pango markup, use <span foreground="#DcDcDc" font_weight="bold">
#   KICKER    top-right label text (uppercase reads best)
#   META      footer tags, "  ·  " separated
#   OUT       output path (default ./post.jpg)
#   OUT_SIZE  final square px (default 1440)
#   SS        supersample factor (default 2)
#
# Requires ImageMagick with Pango (magick -list format | grep -i pango).
set -euo pipefail
cd "$(dirname "$0")"

OUT="${OUT:-post.jpg}"
OUT_SIZE="${OUT_SIZE:-1440}"
SS="${SS:-2}"
KICKER="${KICKER:-BUILT FOR THE AI ERA}"
META="${META:-NO BUILD   ·   WEB COMPONENTS   ·   SSR}"
HEADLINE="${HEADLINE:-The web framework for <span foreground=\"#F0803A\">AI agents</span>}"
SUBTEXT="${SUBTEXT:-No build step. Built on <span foreground=\"#DcDcDc\" font_weight=\"bold\">web components</span>, SSR, and progressive enhancement. <span foreground=\"#DcDcDc\" font_weight=\"bold\">Standards that outlast frameworks.</span>}"

# Everything below is expressed in 1080-design units, multiplied by SS so the
# card renders on an (1080*SS) canvas and is downsized to OUT_SIZE at the end.
s() { echo $(( $1 * SS )); }              # scale one integer
CANVAS=$(s 1080)

W=/tmp/webjs-ig-post
mkdir -p "$W"

# background: dim orange radial cropped so the core sits in the top-right corner
magick -size $(s 2160)x$(s 2160) radial-gradient:'#4a2a14'-'#0a0a0a' \
  -crop ${CANVAS}x${CANVAS}+0+${CANVAS} +repage "$W/bg.png"

LOGO=$(s 76); LR=$(( LOGO - 1 )); LRAD=$(s 22)
magick -size ${LOGO}x${LOGO} -define gradient:angle=135 gradient:'#FF9A45'-'#E06110' \
  \( -size ${LOGO}x${LOGO} xc:none -fill white -draw "roundrectangle 0,0,${LR},${LR},${LRAD},${LRAD}" \) \
  -alpha off -compose CopyOpacity -composite "$W/logo.png"

magick -background none -fill white -font Adwaita-Sans-ExtraBold -pointsize $(s 42) \
  -kerning $(s -1) label:'webjs' "$W/wordmark.png"

magick -background none \
  pango:"<span foreground=\"#E8843C\" font=\"Adwaita Sans Bold $(s 19)\" letter_spacing=\"$(s 3600)\">${KICKER}</span>" \
  "$W/kicker.png"

# Text sits inside the center-safe column so Instagram's 3:4 profile-grid crop
# (trims ~12.5% off each side) never clips it.
magick -background none -size $(s 660)x \
  pango:"<span font=\"Adwaita Sans Heavy $(s 50)\" foreground=\"#F4F4F4\">${HEADLINE}</span>" \
  "$W/headline.png"

magick -background none -size $(s 640)x \
  pango:"<span font=\"Adwaita Sans $(s 27)\" foreground=\"#9a9a9a\">${SUBTEXT}</span>" \
  "$W/subtext.png"

magick -background none \
  pango:"<span foreground=\"#F0803A\" font=\"Adwaita Sans $(s 20)\">&#9679;</span><span foreground=\"#8f8f8f\" font=\"Adwaita Sans Bold $(s 15)\" letter_spacing=\"$(s 1500)\">   ${META}</span>" \
  "$W/footer-left.png"
magick -background none \
  pango:"<span foreground=\"#9a9a9a\" font=\"Adwaita Sans $(s 22)\">webjs.dev</span>" \
  "$W/footer-right.png"

magick -size $(s 660)x$(s 2) xc:'#282828' "$W/divider.png"

# 200px left/right safe margin (in design units) so the grid crop leaves
# comfortable padding, not text touching the thumbnail edge.
PAD=$(s 200)
HY=$(s 336)
H_head=$(identify -format '%h' "$W/headline.png")
SY=$(( HY + H_head + $(s 36) ))

magick "$W/bg.png" \
  "$W/logo.png"         -gravity northwest -geometry +${PAD}+$(s 86)          -composite \
  "$W/wordmark.png"     -gravity northwest -geometry +$(( PAD + $(s 92) ))+$(s 104) -composite \
  "$W/kicker.png"       -gravity northeast -geometry +${PAD}+$(s 112)         -composite \
  "$W/headline.png"     -gravity northwest -geometry +${PAD}+${HY}            -composite \
  "$W/subtext.png"      -gravity northwest -geometry +$(( PAD + $(s 2) ))+${SY} -composite \
  "$W/divider.png"      -gravity northwest -geometry +${PAD}+$(s 902)         -composite \
  "$W/footer-left.png"  -gravity northwest -geometry +${PAD}+$(s 936)         -composite \
  "$W/footer-right.png" -gravity northeast -geometry +${PAD}+$(s 940)         -composite \
  "$W/composed.png"

# Downscale with Lanczos + a light unsharp so glyph edges stay crisp after
# Instagram re-compresses, and output a high-quality JPEG.
magick "$W/composed.png" -filter Lanczos -resize ${OUT_SIZE}x${OUT_SIZE} \
  -unsharp 0x0.6+0.6+0 -colorspace sRGB -strip -quality 95 "$OUT"

identify -format 'built %f %wx%h %m %b\n' "$OUT"
