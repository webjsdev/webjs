import {
  DEFAULT_PRESET_CONFIG,
  ICON_LIBRARIES,
  PRESET_MENU_ACCENTS,
  PRESET_MENU_COLORS,
  PRESET_STYLES,
  decodePreset,
  encodePreset,
  isPresetCode,
  type PresetConfig,
} from '#modules/ui/design-system/preset.js';
import { BASE_COLOR_NAMES, RADII, THEMES, themesForBaseColor } from '#modules/ui/design-system/themes.js';
import { BASE_TITLES } from '#modules/ui/design-system/base-colors.js';
import { FONT_DEFINITIONS } from '#modules/ui/design-system/fonts.js';

/**
 * The /ui/create configurator's state (#1666): one design-system choice, the
 * fields of shadcn's preset code (style, base color, theme, chart color,
 * fonts, icon library, radius, menu), plus which preview block is showing.
 *
 * The state IS the query string, as shadcn's is. The canonical URL carries
 * the share code (`/ui/create?preset=b0`), and the customizer, being a plain
 * GET form, submits the fields one by one, so both are read, a field beside a
 * code winning over the code's.
 *
 * Pure, with no Node imports: <create-customizer> runs the same functions in
 * the browser, over the design-system data copy-registry mirrors into
 * modules/ui/design-system/.
 */

/** A config with every field, chart color included (the code makes it optional). */
export type CreateConfig = Required<PresetConfig>;

export interface CreateParams {
  config: CreateConfig;
  item: string;
}

export type CreateField = 'style' | 'baseColor' | 'theme' | 'chartColor' | 'font' | 'fontHeading' | 'iconLibrary' | 'radius' | 'menuColor' | 'menuAccent';

export const FIELDS: readonly CreateField[] = [
  'style', 'baseColor', 'theme', 'chartColor', 'fontHeading', 'font', 'iconLibrary', 'radius', 'menuColor', 'menuAccent',
];

export interface Option {
  value: string;
  label: string;
  description?: string;
}

/** The preview blocks the configurator's switch shows, shadcn's preview set. */
export const PREVIEW_ITEMS: readonly Option[] = [
  { value: 'preview', label: 'Preview' },
  { value: 'preview-02', label: 'Preview 02' },
  { value: 'preview-03', label: 'Preview 03' },
];
export const DEFAULT_ITEM = 'preview';

/**
 * What the preview can show: a preview block, or any item the explorer lists
 * (a block, or a component's `<name>-demo`). Only the shape is checked here,
 * so the browser can share it; /ui/preview/<item> answers 404 for a name that
 * is neither.
 */
export const ITEM_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The fields a lock can hold through a shuffle, shadcn's LockableParam. */
export type LockableField = CreateField;

/**
 * shadcn's styles (apps/v4/registry/styles.tsx), in its order, then the kit's
 * own new-york, the style a WebJs app has when it names none.
 */
export const STYLE_OPTIONS: readonly Option[] = [
  { value: 'vega', label: 'Vega', description: 'Clean, neutral, and familiar' },
  { value: 'nova', label: 'Nova', description: 'Reduced padding and margins' },
  { value: 'maia', label: 'Maia', description: 'Rounded, with generous spacing.' },
  { value: 'lyra', label: 'Lyra', description: 'Boxy and sharp. For mono fonts.' },
  { value: 'mira', label: 'Mira', description: 'Made for compact interfaces.' },
  { value: 'luma', label: 'Luma', description: 'Fluid, luminous, and soft.' },
  { value: 'sera', label: 'Sera', description: 'Editorial and typographic.' },
  { value: 'rhea', label: 'Rhea', description: 'Like Luma but compact.' },
  { value: 'new-york', label: 'New York', description: 'The WebJs UI default.' },
];

// The option lists built from the design-system data are functions, not
// constants: a module-scope call is work at import time, and this module runs
// in the browser too, where that would pin every page importing it.

export function baseColorOptions(): Option[] {
  return BASE_COLOR_NAMES.map((name: string) => ({ value: name, label: (BASE_TITLES as Record<string, string>)[name] }));
}

/** Every theme; the ones a base color cannot wear are hidden per base. */
export function themeOptions(): Option[] {
  return THEMES.map((t: { name: string; title: string }) => ({ value: t.name, label: t.title }));
}

export function fontOptions(): (Option & { type: string; family: string })[] {
  return FONT_DEFINITIONS.map((f: { name: string; title: string; type: string; family: string }) => ({ value: f.name, label: f.title, type: f.type, family: f.family }));
}

export function iconLibraryOptions(): Option[] {
  return ICON_LIBRARIES.map((l: { name: string; title: string }) => ({ value: l.name, label: l.title }));
}

export function radiusOptions(): Option[] {
  return RADII.map((r: { name: string; label: string }) => ({ value: r.name, label: r.label }));
}

/** shadcn's menu picker: a color (default or inverted) and a surface (solid or translucent). */
export const MENU_COLOR_OPTIONS: readonly Option[] = [
  { value: 'default', label: 'Default / Solid' },
  { value: 'default-translucent', label: 'Default / Translucent' },
  { value: 'inverted', label: 'Inverted / Solid' },
  { value: 'inverted-translucent', label: 'Inverted / Translucent' },
];

/** True for the two translucent menu surfaces. */
export function isTranslucentMenuColor(value: string | undefined): boolean {
  return value === 'default-translucent' || value === 'inverted-translucent';
}

export const MENU_ACCENT_OPTIONS: readonly Option[] = [
  { value: 'subtle', label: 'Subtle' },
  { value: 'bold', label: 'Bold' },
];

/** shadcn's DEFAULT_CONFIG: nova on neutral, Inter, Lucide. */
export const DEFAULT_CONFIG: CreateConfig = { ...DEFAULT_PRESET_CONFIG, style: 'nova', chartColor: 'neutral' };

/** The theme names a base color can wear: itself and every accent. */
export function themeNamesFor(baseColor: string): string[] {
  return themesForBaseColor(baseColor).map((t: { name: string }) => t.name);
}

const ALLOWED: Record<CreateField, () => readonly string[]> = {
  style: () => PRESET_STYLES,
  baseColor: () => BASE_COLOR_NAMES,
  theme: () => THEMES.map((t: { name: string }) => t.name),
  chartColor: () => THEMES.map((t: { name: string }) => t.name),
  font: () => FONT_DEFINITIONS.map((f: { name: string }) => f.name),
  fontHeading: () => ['inherit', ...FONT_DEFINITIONS.map((f: { name: string }) => f.name)],
  iconLibrary: () => ICON_LIBRARIES.map((l: { name: string }) => l.name),
  radius: () => RADII.map((r: { name: string }) => r.name),
  menuColor: () => PRESET_MENU_COLORS,
  menuAccent: () => PRESET_MENU_ACCENTS,
};

/**
 * A complete, valid config from any partial one. An unknown value takes the
 * default, and the dependent fields follow the base color the way shadcn's
 * pickers move them: a theme the base cannot wear (another base color)
 * becomes the base color itself, and so does an unavailable chart color. A
 * heading font equal to the body font is `inherit`.
 */
export function normalizeConfig(input: Partial<Record<CreateField, string | null | undefined>>): CreateConfig {
  const out = { ...DEFAULT_CONFIG } as Record<CreateField, string>;
  for (const field of FIELDS) {
    const value = input[field];
    if (value && ALLOWED[field]().includes(value)) out[field] = value;
  }
  const wearable = themeNamesFor(out.baseColor);
  if (!wearable.includes(out.theme)) out.theme = out.baseColor;
  if (!input.chartColor && input.theme && wearable.includes(input.theme)) out.chartColor = out.theme;
  if (!wearable.includes(out.chartColor)) out.chartColor = out.theme;
  if (out.fontHeading === out.font) out.fontHeading = 'inherit';
  // A translucent menu takes the subtle accent, as shadcn's menu picker sets it.
  if (isTranslucentMenuColor(out.menuColor)) out.menuAccent = 'subtle';
  return out as CreateConfig;
}

type Search = URLSearchParams | Record<string, string | string[] | undefined>;

function reader(search: Search) {
  return (key: string): string | null => {
    if (search instanceof URLSearchParams) return search.get(key);
    const raw = search[key];
    return Array.isArray(raw) ? raw[0] ?? null : raw ?? null;
  };
}

/** The configurator's state from a query string. Never throws: nonsense reads as the default. */
export function parseCreateParams(search: Search): CreateParams {
  const read = reader(search);
  const code = read('preset');
  const decoded = code && isPresetCode(code) ? decodePreset(code) : null;
  const input: Partial<Record<CreateField, string | null>> = { ...(decoded || {}) };
  for (const field of FIELDS) {
    const value = read(field);
    if (value) input[field] = value;
  }
  const item = read('item');
  return {
    config: normalizeConfig(input),
    item: item && ITEM_NAME.test(item) ? item : DEFAULT_ITEM,
  };
}

/** The share code for a config. */
export function presetCode(config: CreateConfig): string {
  return encodePreset(config);
}

/** The one command that installs a config into an app. */
export function initCommand(config: CreateConfig): string {
  return `npx @webjsdev/ui init --preset ${presetCode(config)}`;
}

/** The configurator's URL for a state. The preview item rides only when it is not the default. */
export function createHref(params: CreateParams): string {
  const item = params.item !== DEFAULT_ITEM ? `&item=${params.item}` : '';
  return `/ui/create?preset=${presetCode(params.config)}${item}`;
}

/** The preview frame's URL for a state. */
export function previewHref(params: CreateParams): string {
  return `/ui/preview/${params.item}?preset=${presetCode(params.config)}`;
}

/**
 * shadcn's curated shuffle list (apps/v4/app/(app)/(create)/lib/shuffle-presets.ts,
 * from dialectcn.xyz): Shuffle picks one of these rather than drawing every
 * field at random, so each result is a design someone chose.
 */
export const SHUFFLE_PRESETS: readonly string[] = [
  'b6sUj34d9', 'b2tqYzpa88', 'b1W4tDrk', 'b1aIuQ2XC', 'b7jsW1RxJ5', 'b870VEw0in', 'b3Zheoix4U',
  'b1x9M2c4aI', 'b1W7jDEW', 'b51GFh7y6', 'b2fms620zo', 'b1Q5GC', 'buKEvLs', 'b5rR41Mtnc',
  'b6tOz2I0x', 'b2hNTREGRN', 'bdIJ7Sq', 'b6TqMNb5Wb', 'bJIirQ', 'b4aRK5K0fb', 'b5HCiD38LI',
  'bdHjvCi', 'b7QDHijUjj', 'b4ZVZIPi9h', 'b1W4bcno',
];

/**
 * shadcn's randomize: one of the curated presets, never the one showing, with
 * every locked field kept as it is. `random` defaults to a generator seeded
 * from the current code, so the server renders the same Shuffle link every
 * time (the page's bytes, and so its ETag, stay stable); the browser passes
 * Math.random.
 */
export function shuffleConfig(config: CreateConfig, locks: Iterable<LockableField> = [], random?: () => number): CreateConfig {
  let next = random;
  if (!next) {
    let seed = 0;
    for (const ch of presetCode(config)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
  }
  const current = presetCode(config);
  const pool = SHUFFLE_PRESETS.filter((code) => code !== current);
  const decoded = decodePreset(pool[Math.floor(next() * pool.length)]) ?? {};
  const locked = new Set(locks);
  const picked: Partial<Record<CreateField, string>> = {};
  for (const field of FIELDS) picked[field] = locked.has(field) ? config[field] : (decoded as Record<string, string>)[field];
  if (!locked.has('chartColor') && !picked.chartColor) picked.chartColor = picked.theme;
  return normalizeConfig(picked);
}

/** The label for a field's value, for the picker triggers. */
export function optionLabel(field: CreateField, value: string, config: CreateConfig): string {
  const find = (list: readonly Option[]) => list.find((o) => o.value === value)?.label ?? value;
  switch (field) {
    case 'style': return find(STYLE_OPTIONS);
    case 'baseColor': return find(baseColorOptions());
    case 'theme':
    case 'chartColor': return find(themeOptions());
    case 'font': return find(fontOptions());
    case 'fontHeading': {
      // Inherit shows the body font it inherits, as shadcn's picker does.
      const name = value === 'inherit' ? config.font : value;
      return fontOptions().find((f) => f.value === name)?.label ?? value;
    }
    case 'iconLibrary': return find(iconLibraryOptions());
    case 'radius': return find(radiusOptions());
    case 'menuColor': return find(MENU_COLOR_OPTIONS);
    case 'menuAccent': return find(MENU_ACCENT_OPTIONS);
  }
}
