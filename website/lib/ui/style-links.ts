import { html, asset } from '@webjsdev/core';
import { LEAD_PREVIEWS } from '#modules/ui/docs/lead-previews.ts';
import { parseCreateParams } from '#modules/ui/create/params.ts';
import { FULL_SCREEN_DEMOS } from '#lib/ui/full-screen-demos.ts';

/**
 * Which kit styles each /ui page renders, and so which of public/ui-styles/
 * it links (#1666, D8). Every style is its own sheet, public/ui.css carries
 * none, and a page links exactly the styles its `.style-<name>` wrappers
 * name, because each sheet is about 300 KB of rules, many of them :has(),
 * that the browser re-checks on every style recalculation.
 * test/ssr/ui-style-links.test.ts renders every /ui page and frame and fails
 * when a wrapper's sheet is not linked, so a page added here, or a preview
 * moved into a page, cannot paint in a style it did not load.
 *
 * Each /ui page (and frame) emits its links as the FIRST thing in its own
 * markup, and the /ui chrome layout links new-york, which its header itself
 * renders. The framework moves a stylesheet link that leads a layout's or a
 * page's output into <head>, so it blocks first paint, drops a second link to
 * a file the head already has (each <link> is its own stylesheet, matched
 * again rule by rule, :has() included), and switches a sheet off when a soft
 * navigation replaces the page or layout that linked it and the next page
 * does not link it too (#1669). So a link here must lead its template: one
 * after other markup stays in <body>, where it is not reliably
 * render-blocking (#406).
 */

/** Pages outside the component docs whose content renders a nova preview. */
const NOVA_PAGES = new Set([
  '/ui/create',
  '/ui/typeset',
  '/ui/docs/directory',
  '/ui/docs/forms',
  '/ui/docs/primitives/questionnaire',
  '/ui/docs/rtl',
  '/ui/docs/utils/scroll-fade',
  '/ui/docs/utils/shimmer',
]);

/** Component pages with no nova preview: shown in the chrome's new-york, or in their own style. */
const NO_NOVA_COMPONENTS = new Set([
  'attachment', 'bubble', 'marker', 'message', 'message-scroller', 'sidebar', 'toast', 'trace',
]);

/** Styles a section's pages render besides the chrome's new-york. */
const STYLES_BY_PATH: Record<string, string[]> = {
  // The home page as shadcn renders it: the hero's buttons in luma and the
  // card grid in rhea.
  '/ui': ['luma', 'rhea'],
  // The header buttons, from the luma import in shadcn's colors layout.
  '/ui/colors': ['luma'],
  // The Sera style's own page, every component on it in sera.
  '/ui/sera': ['sera'],
};

const COMPONENT_PAGE = '/ui/docs/components/';

/**
 * The kit styles a /ui page renders, in link order. The configurator's frame
 * renders the style its query names, so it needs the search params too.
 */
export function stylesFor(pathname: string, search: URLSearchParams = new URLSearchParams()): string[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  // The typeset frame renders no kit style. The configurator's frame renders
  // the one its ?preset or ?style names, read the way the page reads it
  // (app/ui/preview/[name]/page.ts).
  if (path.startsWith('/ui/preview/typeset/')) return [];
  if (path.startsWith('/ui/preview/')) return [parseCreateParams(search).config.style];
  // A block frame is new-york, and a full-screen docs demo nova.
  if (path.startsWith('/ui/view/')) return FULL_SCREEN_DEMOS.has(path.slice('/ui/view/'.length)) ? ['nova'] : ['new-york'];
  const styles = new Set(['new-york', ...(STYLES_BY_PATH[path] ?? [])]);
  if (NOVA_PAGES.has(path)) styles.add('nova');
  // The blocks and charts pages' header buttons, which shadcn's layouts
  // import from its luma style.
  if (path === '/ui/blocks' || path.startsWith('/ui/blocks/')) styles.add('luma');
  if (path === '/ui/charts' || path.startsWith('/ui/charts/')) styles.add('luma');
  // The examples: luma header buttons, new-york frames, and nova in the RTL
  // one and the examples' own nova parts.
  if (path.startsWith('/ui/examples/')) { styles.add('luma'); styles.add('nova'); }
  // shadcn shows every AI Elements pattern and the helper pages' demos in
  // rhea. The AI Elements index has no preview.
  if (path.startsWith('/ui/docs/ai-elements/') || path.startsWith('/ui/docs/helpers/')) styles.add('rhea');
  if (path.startsWith(COMPONENT_PAGE)) {
    const name = path.slice(COMPONENT_PAGE.length);
    // The previews render in nova unless the lead one names another style
    // (modules/ui/docs/lead-previews.ts).
    if (!NO_NOVA_COMPONENTS.has(name)) styles.add('nova');
    const lead = LEAD_PREVIEWS[name]?.style;
    if (lead) styles.add(lead);
  }
  return [...styles].sort();
}

/** The stylesheet links for a page's styles. */
export function styleLinks(pathname: string, search?: URLSearchParams) {
  return stylesFor(pathname, search).map((name) => styleLink(name));
}

/**
 * One style's stylesheet link. `data-style-sheet` names the style, so the
 * configurator finds the sheet already in its frame before adding one.
 */
export function styleLink(name: string) {
  return html`<link rel="stylesheet" href=${asset(`/public/ui-styles/${name}.css`)} data-style-sheet=${name}>`;
}
