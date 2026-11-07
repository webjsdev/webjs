import { buildThemeVars, getTheme, isBaseColor } from '#modules/ui/design-system/themes.js';
import { getFont } from '#modules/ui/design-system/fonts.js';
import type { CreateConfig } from './params.ts';

/**
 * A design-system choice as CSS custom properties, for the /ui/create preview
 * (#1666). The configurator's preview frame wears these on its
 * `data-slot="design-system"` wrapper, written at SSR from the query string
 * and rewritten in place by <create-customizer> on every choice, so a choice
 * repaints the frame without reloading it.
 *
 * The colors are shadcn's palettes through the same `buildThemeVars` that
 * `webjsui init --preset` installs, so the preview is what the command
 * installs. Each is one `light-dark(LIGHT, DARK)` value, the site's token
 * form, so the frame follows the reader's light or dark choice with no
 * second set.
 *
 * Pure, with no Node imports: the element imports it in the browser.
 */

/** The radius scale, restated on the wrapper: `.ui-site` computes it against ITS radius. */
const RADIUS_SCALE: Record<string, string> = {
  'radius-sm': 'calc(var(--radius) * 0.6)',
  'radius-md': 'calc(var(--radius) * 0.8)',
  'radius-lg': 'var(--radius)',
  'radius-xl': 'calc(var(--radius) * 1.4)',
  'radius-2xl': 'calc(var(--radius) * 1.8)',
  'radius-3xl': 'calc(var(--radius) * 2.2)',
  'radius-4xl': 'calc(var(--radius) * 2.6)',
};

function lightDark(light: string | undefined, dark: string | undefined): string {
  if (dark === undefined || light === dark) return light ?? '';
  if (light === undefined) return dark;
  return `light-dark(${light}, ${dark})`;
}

/**
 * Every property the preview sets, names with their `--`. The fonts follow
 * shadcn's preview, which always puts the chosen body font on `--font-sans`
 * so it shows whatever its type, and the heading font on `--font-heading`.
 */
export function designSystemVars(config: CreateConfig): Record<string, string> {
  const { light, dark } = buildThemeVars(config);
  const out: Record<string, string> = {};
  for (const key of new Set([...Object.keys(light), ...Object.keys(dark)])) {
    out[`--${key}`] = lightDark(light[key], dark[key]);
  }
  for (const [key, value] of Object.entries(RADIUS_SCALE)) out[`--${key}`] = value;
  const body = getFont(config.font);
  const heading = config.fontHeading !== 'inherit' ? getFont(config.fontHeading) : undefined;
  if (body) out['--font-sans'] = body.family;
  out['--font-heading'] = heading ? heading.family : 'var(--font-sans)';
  return out;
}

/** The same, as an inline `style` value. */
export function designSystemStyle(config: CreateConfig): string {
  return Object.entries(designSystemVars(config)).map(([k, v]) => `${k}: ${v}`).join('; ');
}

/** The wrapper's classes: the chosen style, and the token-driven page surface. */
export function designSystemClass(config: CreateConfig): string {
  return `style-${config.style} min-h-svh bg-background text-foreground [font-family:var(--font-sans)]`;
}

/**
 * The swatch color a theme picker shows, shadcn's: a base color's dark muted
 * foreground, an accent's dark primary.
 */
export function themeSwatch(name: string): string {
  const theme = getTheme(name);
  if (!theme) return 'transparent';
  return theme.cssVars.dark[isBaseColor(name) ? 'muted-foreground' : 'primary'] ?? 'transparent';
}

/** The CSS family stack for a font name, for a picker's "Aa" sample. */
export function fontFamily(name: string): string {
  return getFont(name)?.family ?? 'inherit';
}

/** The extra stylesheet a style needs: public/ui.css carries nova and new-york. */
export function styleSheetHref(style: string): string | null {
  return style === 'nova' || style === 'new-york' ? null : `/public/ui-styles/${style}.css`;
}
