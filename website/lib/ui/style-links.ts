import { html, asset } from '@webjsdev/core';
import { LEAD_PREVIEWS } from '#modules/ui/docs/lead-previews.ts';

/**
 * Which /ui pages render in a kit style public/ui.css does not carry, and so
 * link that style's own stylesheet from public/ui-styles/ (#1666, D8).
 *
 * The answer lives here, once, because two places emit the link. The root
 * layout emits it in its leading <head> run on a full load (only the root
 * layout's leading links are hoisted, and a body stylesheet is not reliably
 * render-blocking, #406). The page emits it again in its own markup for a
 * SOFT navigation, where the root layout is not re-rendered and the router's
 * head merge only adds. The same URL twice costs one fetch, which is the
 * pattern app/ui/layout.ts uses for public/ui.css.
 */
const STYLES_BY_PATH: Record<string, string[]> = {
  // The home page as shadcn renders it: the hero's buttons in luma and the
  // card grid in rhea.
  '/ui': ['luma', 'rhea'],
};

const COMPONENT_PAGE = '/ui/docs/components/';
// The styles public/ui.css carries, which need no link of their own.
const BUILT_IN = new Set(['nova', 'new-york']);

/** The extra kit styles a /ui pathname renders in, in link order. */
export function extraStylesFor(pathname: string): string[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (STYLES_BY_PATH[path]) return STYLES_BY_PATH[path];
  // A component page whose lead demo shadcn shows in another style
  // (modules/ui/docs/lead-previews.ts).
  if (path.startsWith(COMPONENT_PAGE)) {
    const style = LEAD_PREVIEWS[path.slice(COMPONENT_PAGE.length)]?.style;
    if (style && !BUILT_IN.has(style)) return [style];
  }
  return [];
}

/** The stylesheet links for those styles. */
export function extraStyleLinks(pathname: string) {
  return extraStylesFor(pathname).map((name) => html`<link rel="stylesheet" href=${asset(`/public/ui-styles/${name}.css`)}>`);
}
