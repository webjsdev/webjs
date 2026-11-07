/**
 * Design-system presets (#1666): the share code the configurator prints
 * (`npx @webjsdev/ui init --preset <code>`), and what one resolves to.
 *
 * THE CODE is shadcn's preset format (packages/registry/src/preset/preset.ts,
 * MIT), kept wire compatible: a version character (`b`) and a base62 integer
 * that bit-packs one index per field, in this order and width.
 *
 * | field       | bits | values (index 0 is the default)                       |
 * |-------------|------|-------------------------------------------------------|
 * | menuColor   | 3    | default, inverted, default-translucent, inverted-translucent |
 * | menuAccent  | 3    | subtle, bold                                          |
 * | radius      | 4    | default, none, small, medium, large                   |
 * | font        | 6    | the 26 fonts, shadcn's preset order                   |
 * | iconLibrary | 6    | lucide, hugeicons, tabler, phosphor, remixicon        |
 * | theme       | 6    | shadcn's 25 preset themes                             |
 * | baseColor   | 6    | neutral, stone, zinc, gray, mauve, olive, mist, taupe |
 * | style       | 6    | nova, vega, maia, lyra, mira, luma, sera, rhea, new-york |
 * | chartColor  | 6    | as theme (v2 codes only)                              |
 * | fontHeading | 5    | inherit, then the 26 fonts (v2 codes only)            |
 *
 * A shadcn code decodes here to the same fields, and a code encoded here
 * decodes in shadcn the same way, with one exception: `new-york` (the kit's
 * own default style) is APPENDED to the style list, as shadcn's own
 * compatibility rules allow, so a WebJs code naming it decodes in shadcn as
 * index 8, which shadcn reads as out of range and treats as its first style.
 * shadcn's `base` axis (Radix, Base UI, React Aria) is not in the code there
 * either, and the kit has one implementation, so there is nothing to carry.
 *
 * A decoded value is not yet a valid choice: shadcn lists `gray` among its
 * base colours and themes but ships no such palette, and rejects it when the
 * config is validated. {@link resolvePresetConfig} does the same.
 *
 * Pure ESM with no Node imports, so a browser can encode and decode too.
 */

import { BASE_COLOR_NAMES, RADII, buildThemeVars, getTheme, themesForBaseColor } from './themes.js';
import { getFont, googleFontsUrl } from './fonts.js';

export const PRESET_STYLES = ['nova', 'vega', 'maia', 'lyra', 'mira', 'luma', 'sera', 'rhea', 'new-york'];
export const PRESET_BASE_COLORS = ['neutral', 'stone', 'zinc', 'gray', 'mauve', 'olive', 'mist', 'taupe'];
export const PRESET_THEMES = [
  'neutral', 'stone', 'zinc', 'gray', 'amber', 'blue', 'cyan', 'emerald', 'fuchsia', 'green',
  'indigo', 'lime', 'orange', 'pink', 'purple', 'red', 'rose', 'sky', 'teal', 'violet', 'yellow',
  'mauve', 'olive', 'mist', 'taupe',
];
export const PRESET_CHART_COLORS = PRESET_THEMES;
export const PRESET_ICON_LIBRARIES = ['lucide', 'hugeicons', 'tabler', 'phosphor', 'remixicon'];
export const PRESET_FONTS = [
  'inter', 'noto-sans', 'nunito-sans', 'figtree', 'roboto', 'raleway', 'dm-sans', 'public-sans',
  'outfit', 'jetbrains-mono', 'geist', 'geist-mono', 'lora', 'merriweather', 'playfair-display',
  'noto-serif', 'roboto-slab', 'oxanium', 'manrope', 'space-grotesk', 'montserrat', 'ibm-plex-sans',
  'source-sans-3', 'instrument-sans', 'eb-garamond', 'instrument-serif',
];
export const PRESET_FONT_HEADINGS = ['inherit', ...PRESET_FONTS];
export const PRESET_RADII = ['default', 'none', 'small', 'medium', 'large'];
export const PRESET_MENU_ACCENTS = ['subtle', 'bold'];
export const PRESET_MENU_COLORS = ['default', 'inverted', 'default-translucent', 'inverted-translucent'];

const FIELDS_V1 = [
  { key: 'menuColor', values: PRESET_MENU_COLORS, bits: 3 },
  { key: 'menuAccent', values: PRESET_MENU_ACCENTS, bits: 3 },
  { key: 'radius', values: PRESET_RADII, bits: 4 },
  { key: 'font', values: PRESET_FONTS, bits: 6 },
  { key: 'iconLibrary', values: PRESET_ICON_LIBRARIES, bits: 6 },
  { key: 'theme', values: PRESET_THEMES, bits: 6 },
  { key: 'baseColor', values: PRESET_BASE_COLORS, bits: 6 },
  { key: 'style', values: PRESET_STYLES, bits: 6 },
];
const FIELDS_V2 = [
  ...FIELDS_V1,
  { key: 'chartColor', values: PRESET_CHART_COLORS, bits: 6 },
  { key: 'fontHeading', values: PRESET_FONT_HEADINGS, bits: 5 },
];

/**
 * @typedef {object} PresetConfig
 * @property {string} style
 * @property {string} baseColor
 * @property {string} theme
 * @property {string} [chartColor]
 * @property {string} iconLibrary
 * @property {string} font
 * @property {string} fontHeading
 * @property {string} radius
 * @property {string} menuAccent
 * @property {string} menuColor
 */

/**
 * Every field at index 0: what an all-zero code decodes to. Written out
 * rather than computed from the field table, because the module does no work
 * at module scope: the configurator runs it in the browser, and a top-level
 * call would pin every page importing it to the browser (see the kit's
 * AGENTS.md). A test holds it equal to the table.
 *
 * @type {PresetConfig}
 */
export const DEFAULT_PRESET_CONFIG = {
  menuColor: 'default',
  menuAccent: 'subtle',
  radius: 'default',
  font: 'inter',
  iconLibrary: 'lucide',
  theme: 'neutral',
  baseColor: 'neutral',
  style: 'nova',
  chartColor: 'neutral',
  fontHeading: 'inherit',
};

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const VERSIONS = ['a', 'b'];

function toBase62(num) {
  if (num === 0) return '0';
  let out = '';
  let n = num;
  while (n > 0) {
    out = BASE62[n % 62] + out;
    n = Math.floor(n / 62);
  }
  return out;
}

function fromBase62(str) {
  let n = 0;
  for (const ch of str) {
    const i = BASE62.indexOf(ch);
    if (i === -1) return -1;
    n = n * 62 + i;
  }
  return n;
}

/**
 * Encode a config as a v2 (`b`) code. An unknown value encodes as index 0,
 * as in shadcn. A missing field takes its default, except that a missing
 * theme follows the base colour and a missing chart colour follows the
 * theme, so a partial config (`{ baseColor: 'stone' }`) encodes a choice
 * {@link resolvePresetConfig} accepts rather than stone with neutral's
 * theme. Multiplication rather than bit operators, since JavaScript's bitwise
 * operators truncate to 32 bits and the code is 51.
 *
 * @param {Partial<PresetConfig>} config
 */
export function encodePreset(config) {
  const theme = config.theme || config.baseColor || DEFAULT_PRESET_CONFIG.theme;
  const given = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined));
  const merged = { ...DEFAULT_PRESET_CONFIG, theme, chartColor: config.chartColor || theme, ...given };
  let bits = 0;
  let offset = 0;
  for (const field of FIELDS_V2) {
    const idx = field.values.indexOf(merged[field.key]);
    bits += (idx === -1 ? 0 : idx) * 2 ** offset;
    offset += field.bits;
  }
  return 'b' + toBase62(bits);
}

/**
 * Decode a code to its fields, or null when it is not a code. An `a` (v1)
 * code has no chart colour (it then follows the theme) and inherits its
 * heading font. An index past the end of a list decodes to the default.
 *
 * @param {string} code
 * @returns {PresetConfig | null}
 */
export function decodePreset(code) {
  if (!isPresetCode(code)) return null;
  const fields = code[0] === 'a' ? FIELDS_V1 : FIELDS_V2;
  const bits = fromBase62(code.slice(1));
  if (bits < 0) return null;
  /** @type {Record<string, string>} */
  const out = {};
  let offset = 0;
  for (const field of fields) {
    const idx = Math.floor(bits / 2 ** offset) % 2 ** field.bits;
    out[field.key] = idx < field.values.length ? field.values[idx] : field.values[0];
    offset += field.bits;
  }
  if (code[0] === 'a') out.fontHeading = 'inherit';
  return /** @type {PresetConfig} */ (out);
}

/** True when a string has the shape of a preset code (a version, then base62). */
export function isPresetCode(value) {
  if (typeof value !== 'string' || value.length < 2 || value.length > 10) return false;
  if (!VERSIONS.includes(value[0])) return false;
  for (let i = 1; i < value.length; i++) if (BASE62.indexOf(value[i]) === -1) return false;
  return true;
}

/**
 * The icon libraries an app can pick. Each is a registry item whose one file
 * lands beside the cn() helper as `icons.ts` (see `lib/icons*.ts`), so the
 * five export the same names and switching is a file swap.
 */
export const ICON_LIBRARIES = [
  { name: 'lucide', title: 'Lucide', item: 'lib-icons', path: 'lib/icons.ts' },
  { name: 'tabler', title: 'Tabler Icons', item: 'lib-icons-tabler', path: 'lib/icons-tabler.ts' },
  { name: 'hugeicons', title: 'Hugeicons', item: 'lib-icons-hugeicons', path: 'lib/icons-hugeicons.ts' },
  { name: 'phosphor', title: 'Phosphor Icons', item: 'lib-icons-phosphor', path: 'lib/icons-phosphor.ts' },
  { name: 'remixicon', title: 'Remix Icon', item: 'lib-icons-remixicon', path: 'lib/icons-remixicon.ts' },
];

/** The icon library with this name, or undefined. */
export function getIconLibrary(name) {
  return ICON_LIBRARIES.find((l) => l.name === name);
}

/**
 * Validate a decoded (or hand-built) config and fill what it leaves out:
 * `chartColor` follows the theme, a heading font equal to the body font is
 * `inherit`. Returns `{ config }` or `{ error }`, naming the first field that
 * is not a choice the kit offers.
 *
 * @param {Partial<PresetConfig>} input
 * @returns {{ config: PresetConfig, error?: undefined } | { error: string, config?: undefined }}
 */
export function resolvePresetConfig(input) {
  const c = { ...DEFAULT_PRESET_CONFIG, ...input };
  if (!PRESET_STYLES.includes(c.style)) return { error: `Unknown style "${c.style}"` };
  if (!BASE_COLOR_NAMES.includes(c.baseColor)) return { error: `Unknown base color "${c.baseColor}"` };
  if (!getTheme(c.theme) || !themesForBaseColor(c.baseColor).some((t) => t.name === c.theme)) {
    return { error: `Theme "${c.theme}" is not available for base color "${c.baseColor}"` };
  }
  const chartColor = input.chartColor || c.theme;
  if (!getTheme(chartColor) || !themesForBaseColor(c.baseColor).some((t) => t.name === chartColor)) {
    return { error: `Chart color "${chartColor}" is not available for base color "${c.baseColor}"` };
  }
  if (!getIconLibrary(c.iconLibrary)) return { error: `Unknown icon library "${c.iconLibrary}"` };
  if (!getFont(c.font)) return { error: `Unknown font "${c.font}"` };
  if (c.fontHeading !== 'inherit' && !getFont(c.fontHeading)) return { error: `Unknown heading font "${c.fontHeading}"` };
  if (!RADII.some((r) => r.name === c.radius)) return { error: `Unknown radius "${c.radius}"` };
  if (!PRESET_MENU_ACCENTS.includes(c.menuAccent)) return { error: `Unknown menu accent "${c.menuAccent}"` };
  if (!PRESET_MENU_COLORS.includes(c.menuColor)) return { error: `Unknown menu color "${c.menuColor}"` };
  const fontHeading = c.fontHeading === c.font ? 'inherit' : c.fontHeading;
  return { config: { ...c, chartColor, fontHeading } };
}

/**
 * The `@theme inline` tokens a config's fonts set: the body font's own token
 * (`--font-sans`, `--font-mono` or `--font-serif`), `--font-sans` as well
 * when the body font is a serif or a mono, and `--font-heading`, which is the
 * heading font or, when inherited, a reference to the body font's token. Bare
 * names, as `cssVars.theme` spells them.
 *
 * `--font-sans` is Tailwind's default family, the one the page's text takes.
 * shadcn puts its body font's class on `<body>` from the Next layout; a WebJs
 * app has no such hook, so the body font reaches the page through this token,
 * which is how the configurator previews it whatever its kind.
 *
 * @param {PresetConfig} config
 * @returns {Record<string, string>}
 */
export function presetFontVars(config) {
  const body = getFont(config.font);
  const heading = config.fontHeading !== 'inherit' ? getFont(config.fontHeading) : undefined;
  if (!body) return {};
  const vars = { [body.variable.slice(2)]: body.family };
  if (body.variable !== '--font-sans') vars['font-sans'] = body.family;
  vars['font-heading'] = heading ? heading.family : `var(${body.variable})`;
  return vars;
}

/**
 * Everything a preset installs, as one `registry:base` item (shadcn's
 * `/init` payload shape): the merged tokens, the font tokens, the items to
 * pull (the helpers, the icon library, the font items), and the config
 * itself under `meta`, since the kit's item schema has no `config` field.
 *
 * @param {PresetConfig} config a resolved config (see {@link resolvePresetConfig})
 */
export function buildPresetItem(config) {
  const code = encodePreset(config);
  const { light, dark } = buildThemeVars(config);
  const icons = getIconLibrary(config.iconLibrary);
  const registryDependencies = ['lib-utils', 'lib-dom', icons ? icons.item : 'lib-icons', `font-${config.font}`];
  if (config.fontHeading !== 'inherit') registryDependencies.push(`font-heading-${config.fontHeading}`);
  return {
    $schema: 'https://ui.webjs.dev/schema/registry-item.json',
    name: `preset-${code}`,
    type: 'registry:base',
    title: `${config.style} / ${config.baseColor} / ${config.theme}`,
    description: `The design system for preset ${code}. Install it with: npx @webjsdev/ui init --preset ${code}`,
    dependencies: ['@webjsdev/core'],
    registryDependencies,
    cssVars: { theme: presetFontVars(config), light, dark },
    meta: { preset: code, config: { ...config } },
  };
}

/**
 * The Google Fonts stylesheet URLs a config's fonts need, body first.
 *
 * @param {PresetConfig} config
 */
export function presetFontUrls(config) {
  const names = [config.font, config.fontHeading].filter((n, i, all) => n && n !== 'inherit' && all.indexOf(n) === i);
  return names.map((n) => getFont(n)).filter(Boolean).map((f) => googleFontsUrl(/** @type {any} */ (f)));
}
