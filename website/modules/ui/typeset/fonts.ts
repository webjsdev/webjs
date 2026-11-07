/**
 * The typeset builder's fonts, ported from shadcn/ui's
 * apps/v4/lib/font-definitions.ts and app/(app)/(typeset)/lib/fonts.ts
 * (#1666).
 *
 * shadcn's list minus the three display faces its typeset leaves out
 * (Instrument Serif, EB Garamond, Playfair Display), in shadcn's order, so
 * the pickers and the shuffle read the same set. Every face is self-hosted
 * from public/fonts/ the way next/font self-hosts shadcn's: one latin
 * variable woff2 per family, fetched by scripts/fetch-fonts.mjs (which reads
 * THIS list, so the two cannot drift) and declared in public/typeset-fonts.css.
 *
 * `range` is the family's variable weight axis, which Google's css2 API needs
 * verbatim (it refuses a range wider than the font has). The values are
 * next/font's own font-data.json.
 *
 * The family names are Google's ('Geist', not fontsource's 'Geist Variable'),
 * the same names the site's other @font-face rules declare, and the names the
 * docs panel tells an app to declare.
 *
 * No imports, so the plain Node script can load it too.
 */

export type FontType = 'sans' | 'serif' | 'mono';

export interface TypesetFont {
  /** The param value and the --font-<id> variable the docs emit. */
  id: string;
  /** The family name, and the picker label. */
  name: string;
  type: FontType;
  /** The variable weight axis, as css2 spells it. */
  range: string;
}

export const FONTS: readonly TypesetFont[] = [
  { id: 'geist', name: 'Geist', type: 'sans', range: '100..900' },
  { id: 'inter', name: 'Inter', type: 'sans', range: '100..900' },
  { id: 'noto-sans', name: 'Noto Sans', type: 'sans', range: '100..900' },
  { id: 'nunito-sans', name: 'Nunito Sans', type: 'sans', range: '200..1000' },
  { id: 'figtree', name: 'Figtree', type: 'sans', range: '300..900' },
  { id: 'roboto', name: 'Roboto', type: 'sans', range: '100..900' },
  { id: 'raleway', name: 'Raleway', type: 'sans', range: '100..900' },
  { id: 'dm-sans', name: 'DM Sans', type: 'sans', range: '100..1000' },
  { id: 'public-sans', name: 'Public Sans', type: 'sans', range: '100..900' },
  { id: 'outfit', name: 'Outfit', type: 'sans', range: '100..900' },
  { id: 'oxanium', name: 'Oxanium', type: 'sans', range: '200..800' },
  { id: 'manrope', name: 'Manrope', type: 'sans', range: '200..800' },
  { id: 'space-grotesk', name: 'Space Grotesk', type: 'sans', range: '300..700' },
  { id: 'montserrat', name: 'Montserrat', type: 'sans', range: '100..900' },
  { id: 'ibm-plex-sans', name: 'IBM Plex Sans', type: 'sans', range: '100..700' },
  { id: 'source-sans-3', name: 'Source Sans 3', type: 'sans', range: '200..900' },
  { id: 'instrument-sans', name: 'Instrument Sans', type: 'sans', range: '400..700' },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', type: 'mono', range: '100..800' },
  { id: 'geist-mono', name: 'Geist Mono', type: 'mono', range: '100..900' },
  { id: 'noto-serif', name: 'Noto Serif', type: 'serif', range: '100..900' },
  { id: 'roboto-slab', name: 'Roboto Slab', type: 'serif', range: '100..900' },
  { id: 'merriweather', name: 'Merriweather', type: 'serif', range: '300..900' },
  { id: 'lora', name: 'Lora', type: 'serif', range: '400..700' },
];

/** The font with this id, if there is one. */
export function findFont(id: string | null | undefined): TypesetFont | undefined {
  return FONTS.find((font) => font.id === id);
}

/** The CSS font-family stack for a font: the family, then its generic. */
export function fontStack(font: TypesetFont): string {
  const generic = font.type === 'mono' ? 'monospace' : font.type === 'serif' ? 'serif' : 'sans-serif';
  return `'${font.name}', ${generic}`;
}
