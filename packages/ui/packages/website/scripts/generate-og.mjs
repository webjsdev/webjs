#!/usr/bin/env node
/**
 * Generate the Open Graph card for ui.webjs.dev.
 *
 * Mirrors the design language of website/public/og.png (the marketing
 * site's card): warm-orange-on-dark, serif headline, mono rubric. Content
 * is swapped to describe the UI component library rather than the
 * framework itself.
 *
 * Run with:
 *   node scripts/generate-og.mjs
 *
 * Requires `rsvg-convert` on PATH (librsvg): installed system-wide on
 * the dev machine. Produces:
 *   public/og.svg   (vector source, committed for diff-friendly edits)
 *   public/og.png   (1200x630, committed and referenced from layout.ts)
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const W = 1200;
const H = 630;

// Warm-orange-on-dark palette pulled from the chrome's dark-mode tokens
// (`app/layout.ts` :root[data-theme='dark']). Hex approximations so the
// SVG renders identically regardless of the consumer's color management.
const BG_BASE = '#1c1613';      // --bg (oklch 0.14 0.01 55)
const ACCENT  = '#f6a06b';      // --accent (oklch 0.78 0.14 55)
const FG      = '#f8f0e9';      // --fg (oklch 0.96 0.015 60)
const FG_MUTED = '#c5b8ad';     // --fg-muted (oklch 0.72 0.02 60)
const FG_SUBTLE = '#8a7d72';    // --fg-subtle (oklch 0.55 0.02 60)
// The logo mark gradient, matching the dark navbar mark (--logo-from/--logo-to
// in app/layout.ts, oklch 0.8 0.16 58 -> 0.62 0.18 44). Hex approximations so
// rsvg-convert renders it identically regardless of color management.
const LOGO_FROM = '#ffa146';    // --logo-from dark (oklch 0.8 0.16 58)
const LOGO_TO   = '#da5801';    // --logo-to dark (oklch 0.62 0.18 44)

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Warm radial glow concentrated near the top-left, fading to BG_BASE.
         Mirrors the gradient on the webjs.dev OG card. -->
    <radialGradient id="glow" cx="20%" cy="0%" r="80%" fx="20%" fy="0%">
      <stop offset="0%"   stop-color="${ACCENT}" stop-opacity="0.28"/>
      <stop offset="30%"  stop-color="${ACCENT}" stop-opacity="0.12"/>
      <stop offset="60%"  stop-color="${ACCENT}" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bottom-vignette" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="60%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
    </linearGradient>
    <!-- Brand mark gradient, top-left to bottom-right, matching the navbar. -->
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="${LOGO_FROM}"/>
      <stop offset="100%" stop-color="${LOGO_TO}"/>
    </linearGradient>
  </defs>

  <!-- Base dark fill -->
  <rect width="${W}" height="${H}" fill="${BG_BASE}"/>

  <!-- Warm corner glow -->
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Bottom vignette for depth -->
  <rect width="${W}" height="${H}" fill="url(#bottom-vignette)"/>

  <!-- Logo: orange rounded square (navbar mark gradient) + wordmark -->
  <g transform="translate(64, 60)">
    <rect width="36" height="36" rx="11" fill="url(#mark)"/>
    <rect width="36" height="36" rx="11" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1"/>
    <text x="52" y="26" font-family="Liberation Sans, sans-serif" font-size="22"
          font-weight="700" fill="${FG}" letter-spacing="-0.4">webjs ui</text>
  </g>

  <!-- Hero headline (serif, big, two lines) -->
  <g font-family="Liberation Serif, Georgia, serif" fill="${FG}"
     font-size="76" font-weight="700" letter-spacing="-2.5">
    <text x="64" y="305">A component library</text>
    <text x="64" y="385">written for AI agents.</text>
  </g>

  <!-- Subtitle (sans-serif, muted, two lines) -->
  <g font-family="Liberation Sans, sans-serif" fill="${FG_MUTED}"
     font-size="22" font-weight="400">
    <text x="64" y="445">32 primitives. shadcn API parity. Native HTML semantics.</text>
    <text x="64" y="478">Zero third-party deps. Copy-paste source. Works anywhere.</text>
  </g>

  <!-- Rubric (small, mono, uppercase, tracked-out): bottom-left -->
  <g font-family="JetBrainsMono Nerd Font, monospace" font-size="14"
     font-weight="600" letter-spacing="2">
    <text x="64" y="568" fill="${ACCENT}">●</text>
    <text x="86" y="568" fill="${FG_MUTED}">COMPOSITION-FIRST  ·  NATIVE SEMANTICS  ·  ZERO DEPS</text>
  </g>

  <!-- Domain badge: bottom-right -->
  <text x="${W - 64}" y="568" text-anchor="end"
        font-family="JetBrainsMono Nerd Font, monospace" font-size="14"
        font-weight="600" letter-spacing="2" fill="${FG_SUBTLE}">UI.WEBJS.DEV</text>
</svg>
`;

const svgPath = join(publicDir, 'og.svg');
const pngPath = join(publicDir, 'og.png');
writeFileSync(svgPath, svg);

// Convert SVG → PNG at native 1200x630. rsvg-convert respects font fallbacks
// declared in the SVG (Liberation Serif, Liberation Sans, JetBrains Mono
// Nerd Font): all guaranteed on the dev machine via fontconfig.
execFileSync('rsvg-convert', ['-w', String(W), '-h', String(H), svgPath, '-o', pngPath]);
console.log(`Wrote ${svgPath}`);
console.log(`Wrote ${pngPath} (${W}x${H})`);
