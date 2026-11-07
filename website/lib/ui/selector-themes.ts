/**
 * The themes shadcn's section ThemeSelector offers (#1666), and the pure
 * helpers for the `?theme=` they ride on. Kept apart from
 * lib/ui/theme-selector.ts, which renders the selector, so a pure module such
 * as the tasks example's query-string state can read the theme without
 * importing markup.
 */

/** shadcn's THEMES: its legacy base colours without slate, stone, gray and zinc, by name. */
export const SELECTOR_THEMES = ['blue', 'green', 'neutral', 'orange', 'red', 'rose', 'violet', 'yellow'];
export const DEFAULT_SELECTOR_THEME = 'neutral';

/** The theme a request asks for, or the default. */
export function readSelectorTheme(params: URLSearchParams): string {
  const t = params.get('theme') ?? '';
  return SELECTOR_THEMES.includes(t) ? t : DEFAULT_SELECTOR_THEME;
}

/** The class a themed region wears; the default theme wears none. */
export function themeClass(name: string): string {
  return name === DEFAULT_SELECTOR_THEME ? '' : `theme-${name}`;
}

/** A link that carries the theme, as the selector's links do. */
export function withTheme(href: string, name: string): string {
  return name === DEFAULT_SELECTOR_THEME ? href : `${href}${href.includes('?') ? '&' : '?'}theme=${name}`;
}
