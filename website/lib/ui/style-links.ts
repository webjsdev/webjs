import { html, asset } from '@webjsdev/core';
import { LEAD_PREVIEWS } from '#modules/ui/docs/lead-previews.ts';

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
 * The answer lives here, once, because three places emit the links. The root
 * layout emits them in its leading <head> run on a full load (only the root
 * layout's leading links are hoisted, and a body stylesheet is not reliably
 * render-blocking, #406). The page emits them again in its own markup for a
 * SOFT navigation, where the root layout is not re-rendered and the router's
 * head merge only adds; the router loads such a link before it swaps the page
 * in, so the page paints in its style from the first frame. And the /ui
 * chrome layout links new-york, which its header itself renders, for a soft
 * navigation in from the marketing site. The same URL twice costs one fetch.
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

/** The kit styles a /ui pathname renders, in link order. */
export function stylesFor(pathname: string): string[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  // The configurator's frame links the style it was asked for itself
  // (app/ui/preview/[name]/page.ts), and the typeset frame renders none.
  if (path.startsWith('/ui/preview/')) return [];
  // A block frame is new-york; the one full-screen docs demo it can show
  // instead links nova itself (app/ui/view/[name]/page.ts).
  if (path.startsWith('/ui/view/')) return ['new-york'];
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

/** The stylesheet links for a pathname's styles. */
export function styleLinks(pathname: string) {
  return stylesFor(pathname).map((name) => html`<link rel="stylesheet" href=${asset(`/public/ui-styles/${name}.css`)}>`);
}

/** One style's stylesheet link, for a region that renders a style its path does not imply. */
export function styleLink(name: string) {
  return html`<link rel="stylesheet" href=${asset(`/public/ui-styles/${name}.css`)}>`;
}
