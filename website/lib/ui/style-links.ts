import { html, asset } from '@webjsdev/core';

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

/** The extra kit styles a /ui pathname renders in, in link order. */
export function extraStylesFor(pathname: string): string[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return STYLES_BY_PATH[path] ?? [];
}

/** The stylesheet links for those styles. */
export function extraStyleLinks(pathname: string) {
  return extraStylesFor(pathname).map((name) => html`<link rel="stylesheet" href=${asset(`/public/ui-styles/${name}.css`)}>`);
}
