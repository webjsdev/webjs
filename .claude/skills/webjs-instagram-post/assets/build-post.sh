#!/usr/bin/env bash
#
# Build one on-theme WebJs Instagram post image (1080x1080 JPEG) that matches
# the webjs.dev OG cards: near-black background, a soft warm glow in the
# top-right corner, the orange squircle mark plus the white "webjs" wordmark,
# a bold white headline with one orange-highlighted phrase, gray subtext, and
# a small-caps footer meta row with a "webjs.dev" URL.
#
# Override the copy per post via env vars (all optional):
#   HEADLINE  pango markup, wrap the key phrase in <span foreground="#F0803A">
#   SUBTEXT   pango markup, use <span foreground="#DcDcDc" font_weight="bold">
#   KICKER    top-right label text (uppercase reads best)
#   META      footer tags, "  ·  " separated
#   OUT       output path (default ./post.jpg)
#
# Requires ImageMagick with Pango (magick -list format | grep -i pango).
set -euo pipefail
cd "$(dirname "$0")"

OUT="${OUT:-post.jpg}"
KICKER="${KICKER:-BUILT FOR THE AI ERA}"
META="${META:-NO BUILD   ·   WEB COMPONENTS   ·   SSR}"
HEADLINE="${HEADLINE:-The web framework for <span foreground=\"#F0803A\">AI agents</span>}"
SUBTEXT="${SUBTEXT:-No build step. Built on <span foreground=\"#DcDcDc\" font_weight=\"bold\">web components</span>, SSR, and progressive enhancement. <span foreground=\"#DcDcDc\" font_weight=\"bold\">Standards that outlast frameworks.</span>}"

W=/tmp/webjs-ig-post
mkdir -p "$W"

# background: dim orange radial cropped so the core sits in the top-right corner
magick -size 2160x2160 radial-gradient:'#4a2a14'-'#0a0a0a' \
  -crop 1080x1080+0+1080 +repage "$W/bg.png"

magick -size 76x76 -define gradient:angle=135 gradient:'#FF9A45'-'#E06110' \
  \( -size 76x76 xc:none -fill white -draw 'roundrectangle 0,0,75,75,22,22' \) \
  -alpha off -compose CopyOpacity -composite "$W/logo.png"

magick -background none -fill white -font Adwaita-Sans-ExtraBold -pointsize 42 \
  -kerning -1 label:'webjs' "$W/wordmark.png"

magick -background none \
  pango:"<span foreground=\"#E8843C\" font=\"Adwaita Sans Bold 19\" letter_spacing=\"3600\">${KICKER}</span>" \
  "$W/kicker.png"

# Text is sized to sit inside the center-safe column. Instagram's profile
# grid crops a 1:1 post to 3:4 portrait (keeps full height, trims ~12.5% off
# each side), so nothing critical may run to the horizontal edges.
magick -background none -size 780x \
  pango:"<span font=\"Adwaita Sans Heavy 54\" foreground=\"#F4F4F4\">${HEADLINE}</span>" \
  "$W/headline.png"

magick -background none -size 720x \
  pango:"<span font=\"Adwaita Sans 29\" foreground=\"#9a9a9a\">${SUBTEXT}</span>" \
  "$W/subtext.png"

magick -background none \
  pango:"<span foreground=\"#F0803A\" font=\"Adwaita Sans 20\">&#9679;</span><span foreground=\"#8f8f8f\" font=\"Adwaita Sans Bold 15\" letter_spacing=\"1500\">   ${META}</span>" \
  "$W/footer-left.png"
magick -background none \
  pango:'<span foreground="#9a9a9a" font="Adwaita Sans 22">webjs.dev</span>' \
  "$W/footer-right.png"

magick -size 660x2 xc:'#282828' "$W/divider.png"

# Left/right margins put every element inside the center-safe column
# (x from ~140 to ~940) so the 3:4 grid crop never clips text.
PAD=140
HY=336
H_head=$(identify -format '%h' "$W/headline.png")
SY=$(( HY + H_head + 36 ))

magick "$W/bg.png" \
  "$W/logo.png"         -gravity northwest -geometry +${PAD}+86    -composite \
  "$W/wordmark.png"     -gravity northwest -geometry +$((PAD+92))+104 -composite \
  "$W/kicker.png"       -gravity northeast -geometry +${PAD}+112   -composite \
  "$W/headline.png"     -gravity northwest -geometry +${PAD}+${HY} -composite \
  "$W/subtext.png"      -gravity northwest -geometry +$((PAD+2))+${SY} -composite \
  "$W/divider.png"      -gravity northwest -geometry +${PAD}+902   -composite \
  "$W/footer-left.png"  -gravity northwest -geometry +${PAD}+936   -composite \
  "$W/footer-right.png" -gravity northeast -geometry +${PAD}+940   -composite \
  -quality 92 "$OUT"

identify -format 'built %f %wx%h %m %b\n' "$OUT"
