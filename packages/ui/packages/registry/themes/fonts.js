/**
 * The 26 font families the configurator offers, ported from shadcn/ui's
 * apps/v4/lib/font-definitions.ts (MIT) in shadcn's order (#1666), and the
 * `registry:font` items built from them (shadcn's registry/fonts.ts).
 *
 * Two departures, both because a WebJs app has no next/font and no bundler:
 *
 *  - `family` is the family's own name ('Inter', sans-serif), not
 *    fontsource's 'Inter Variable'. The face is loaded from a stylesheet
 *    (Google Fonts, or self-hosted woff2 under public/), and both declare it
 *    under its own name.
 *  - `range` is the variable weight axis, as Google's css2 API spells it
 *    (it refuses a range wider than the font has), so {@link googleFontsUrl}
 *    can build the link. The values are next/font's font-data.json. A face
 *    with no variable axis has `weights` instead.
 *
 * shadcn's `import` (the next/font export name) and `dependency` (the
 * fontsource package) are kept, so an item reads the same on the wire.
 *
 * Pure data with no imports, so the CLI, the site and a browser can load it.
 */

/**
 * @typedef {object} FontDefinition
 * @property {string} name      the id: `font-<name>` is its registry item
 * @property {string} title
 * @property {'sans' | 'mono' | 'serif'} type
 * @property {string} family    the CSS font-family stack
 * @property {'--font-sans' | '--font-mono' | '--font-serif'} variable  the token a body font sets
 * @property {string} import    next/font's export name (shadcn parity)
 * @property {string} dependency fontsource's package (shadcn parity)
 * @property {string} [range]   the variable weight axis, css2 spelling
 * @property {string[]} [weights] the static weights of a non-variable face
 */

/** @type {FontDefinition[]} */
export const FONT_DEFINITIONS = [
  { name: 'geist', title: 'Geist', type: 'sans', family: "'Geist', sans-serif", variable: '--font-sans', import: 'Geist', dependency: '@fontsource-variable/geist', range: '100..900' },
  { name: 'inter', title: 'Inter', type: 'sans', family: "'Inter', sans-serif", variable: '--font-sans', import: 'Inter', dependency: '@fontsource-variable/inter', range: '100..900' },
  { name: 'noto-sans', title: 'Noto Sans', type: 'sans', family: "'Noto Sans', sans-serif", variable: '--font-sans', import: 'Noto_Sans', dependency: '@fontsource-variable/noto-sans', range: '100..900' },
  { name: 'nunito-sans', title: 'Nunito Sans', type: 'sans', family: "'Nunito Sans', sans-serif", variable: '--font-sans', import: 'Nunito_Sans', dependency: '@fontsource-variable/nunito-sans', range: '200..1000' },
  { name: 'figtree', title: 'Figtree', type: 'sans', family: "'Figtree', sans-serif", variable: '--font-sans', import: 'Figtree', dependency: '@fontsource-variable/figtree', range: '300..900' },
  { name: 'roboto', title: 'Roboto', type: 'sans', family: "'Roboto', sans-serif", variable: '--font-sans', import: 'Roboto', dependency: '@fontsource-variable/roboto', range: '100..900' },
  { name: 'raleway', title: 'Raleway', type: 'sans', family: "'Raleway', sans-serif", variable: '--font-sans', import: 'Raleway', dependency: '@fontsource-variable/raleway', range: '100..900' },
  { name: 'dm-sans', title: 'DM Sans', type: 'sans', family: "'DM Sans', sans-serif", variable: '--font-sans', import: 'DM_Sans', dependency: '@fontsource-variable/dm-sans', range: '100..1000' },
  { name: 'public-sans', title: 'Public Sans', type: 'sans', family: "'Public Sans', sans-serif", variable: '--font-sans', import: 'Public_Sans', dependency: '@fontsource-variable/public-sans', range: '100..900' },
  { name: 'outfit', title: 'Outfit', type: 'sans', family: "'Outfit', sans-serif", variable: '--font-sans', import: 'Outfit', dependency: '@fontsource-variable/outfit', range: '100..900' },
  { name: 'oxanium', title: 'Oxanium', type: 'sans', family: "'Oxanium', sans-serif", variable: '--font-sans', import: 'Oxanium', dependency: '@fontsource-variable/oxanium', range: '200..800' },
  { name: 'manrope', title: 'Manrope', type: 'sans', family: "'Manrope', sans-serif", variable: '--font-sans', import: 'Manrope', dependency: '@fontsource-variable/manrope', range: '200..800' },
  { name: 'space-grotesk', title: 'Space Grotesk', type: 'sans', family: "'Space Grotesk', sans-serif", variable: '--font-sans', import: 'Space_Grotesk', dependency: '@fontsource-variable/space-grotesk', range: '300..700' },
  { name: 'montserrat', title: 'Montserrat', type: 'sans', family: "'Montserrat', sans-serif", variable: '--font-sans', import: 'Montserrat', dependency: '@fontsource-variable/montserrat', range: '100..900' },
  { name: 'ibm-plex-sans', title: 'IBM Plex Sans', type: 'sans', family: "'IBM Plex Sans', sans-serif", variable: '--font-sans', import: 'IBM_Plex_Sans', dependency: '@fontsource-variable/ibm-plex-sans', range: '100..700' },
  { name: 'source-sans-3', title: 'Source Sans 3', type: 'sans', family: "'Source Sans 3', sans-serif", variable: '--font-sans', import: 'Source_Sans_3', dependency: '@fontsource-variable/source-sans-3', range: '200..900' },
  { name: 'instrument-sans', title: 'Instrument Sans', type: 'sans', family: "'Instrument Sans', sans-serif", variable: '--font-sans', import: 'Instrument_Sans', dependency: '@fontsource-variable/instrument-sans', range: '400..700' },
  { name: 'jetbrains-mono', title: 'JetBrains Mono', type: 'mono', family: "'JetBrains Mono', monospace", variable: '--font-mono', import: 'JetBrains_Mono', dependency: '@fontsource-variable/jetbrains-mono', range: '100..800' },
  { name: 'geist-mono', title: 'Geist Mono', type: 'mono', family: "'Geist Mono', monospace", variable: '--font-mono', import: 'Geist_Mono', dependency: '@fontsource-variable/geist-mono', range: '100..900' },
  { name: 'noto-serif', title: 'Noto Serif', type: 'serif', family: "'Noto Serif', serif", variable: '--font-serif', import: 'Noto_Serif', dependency: '@fontsource-variable/noto-serif', range: '100..900' },
  { name: 'roboto-slab', title: 'Roboto Slab', type: 'serif', family: "'Roboto Slab', serif", variable: '--font-serif', import: 'Roboto_Slab', dependency: '@fontsource-variable/roboto-slab', range: '100..900' },
  { name: 'merriweather', title: 'Merriweather', type: 'serif', family: "'Merriweather', serif", variable: '--font-serif', import: 'Merriweather', dependency: '@fontsource-variable/merriweather', range: '300..900' },
  { name: 'lora', title: 'Lora', type: 'serif', family: "'Lora', serif", variable: '--font-serif', import: 'Lora', dependency: '@fontsource-variable/lora', range: '400..700' },
  { name: 'playfair-display', title: 'Playfair Display', type: 'serif', family: "'Playfair Display', serif", variable: '--font-serif', import: 'Playfair_Display', dependency: '@fontsource-variable/playfair-display', range: '400..900' },
  { name: 'eb-garamond', title: 'EB Garamond', type: 'serif', family: "'EB Garamond', serif", variable: '--font-serif', import: 'EB_Garamond', dependency: '@fontsource-variable/eb-garamond', range: '400..800' },
  { name: 'instrument-serif', title: 'Instrument Serif', type: 'serif', family: "'Instrument Serif', serif", variable: '--font-serif', import: 'Instrument_Serif', dependency: '@fontsource/instrument-serif', weights: ['400'] },
];

/** The font with this name, or undefined. */
export function getFont(name) {
  return FONT_DEFINITIONS.find((f) => f.name === name);
}

/**
 * The Google Fonts stylesheet URL that serves a font at its full weight
 * range, for an app that does not self-host it.
 *
 * @param {FontDefinition} font
 */
export function googleFontsUrl(font) {
  const family = font.title.replace(/ /g, '+');
  const axis = font.range ? `:wght@${font.range}` : font.weights ? `:wght@${font.weights.join(';')}` : '';
  return `https://fonts.googleapis.com/css2?family=${family}${axis}&display=swap`;
}

/**
 * The `registry:font` item for a font, in shadcn's shape: a body font
 * (`font-<name>`) sets the token its type uses, a heading font
 * (`font-heading-<name>`) sets `--font-heading`. `cssVars.theme` carries the
 * token, so `add` merges it into the app's `@theme inline` block.
 *
 * @param {FontDefinition} font
 * @param {'body' | 'heading'} role
 */
export function fontItem(font, role) {
  const variable = role === 'body' ? font.variable : '--font-heading';
  return {
    name: role === 'body' ? `font-${font.name}` : `font-heading-${font.name}`,
    title: role === 'body' ? font.title : `${font.title} (Heading)`,
    type: 'registry:font',
    description: `${font.title}, loaded from ${googleFontsUrl(font)} or self-hosted under public/.`,
    font: {
      family: font.family,
      provider: 'google',
      variable,
      ...(font.weights ? { weight: [...font.weights] } : {}),
      subsets: ['latin'],
      import: font.import,
      dependency: font.dependency,
    },
    // Bare token names, as every kit item's cssVars spells them (add's
    // mergeCssVars writes `--<name>`).
    cssVars: { theme: { [variable.slice(2)]: font.family } },
  };
}

/** Every font item: the 26 body fonts, then the 26 heading fonts. */
export function fontItems() {
  return [
    ...FONT_DEFINITIONS.map((f) => fontItem(f, 'body')),
    ...FONT_DEFINITIONS.map((f) => fontItem(f, 'heading')),
  ];
}
