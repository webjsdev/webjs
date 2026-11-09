import { html, asset } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
// Every kit element, so the docs demos (rendered to strings) upgrade (D14).
import '#modules/ui/elements.ts';

/**
 * The /ui section's outermost layout, deliberately minimal (#1666).
 *
 * EVERY /ui page renders inside it, including the bare iframe targets under
 * /ui/view and /ui/preview, which must show no header or footer. No export or
 * flag lets a page skip a parent layout, so anything visible belongs one level
 * down, in app/ui/(chrome)/layout.ts, and this file holds only what every /ui
 * page needs:
 *
 * - the `.ui-site` wrapper, which declares the /ui palette and type (see
 *   public/ui-input.css). The tokens live on the wrapper rather than :root so
 *   they never leak into a marketing page. It carries NO kit style: the
 *   registry components are in base form and take their look from the
 *   nearest `.style-<name>` ancestor (#1666, D8), and two style wrappers on
 *   one path both apply, so each region names its own (the gallery
 *   new-york, the home page luma and rhea).
 * - the /ui stylesheet link, the one place it is written. It comes first, so
 *   the framework moves it into <head> on every render and switches it off
 *   when a soft navigation leaves /ui (#1669).
 *
 * This is a NON-ROOT layout (invariant 8), so it writes no document shell.
 */

const UI_DESCRIPTION =
  'Accessible components for WebJs, built on native HTML and styled with Tailwind v4. Copy the source into your app and make it your own.';
const UI_OG_TITLE = 'WebJs UI';

/**
 * UI-scoped metadata, merged over the root layout's for every page under
 * /ui. `openGraph` and `twitter` REPLACE the root's objects rather than
 * merging into them, so every field is restated here. Keep these in step with
 * app/layout.ts.
 */
export function generateMetadata(ctx: { url: string }) {
  const { origin, pathname } = new URL(ctx.url);
  const image = `${origin}/og.png`;
  return {
    description: UI_DESCRIPTION,
    openGraph: {
      type: 'article',
      title: UI_OG_TITLE,
      description: UI_DESCRIPTION,
      url: origin + pathname,
      image,
      'image:width': '1200',
      'image:height': '630',
      'image:alt': UI_OG_TITLE,
      'site_name': 'WebJs',
    },
    twitter: {
      card: 'summary_large_image',
      title: UI_OG_TITLE,
      description: UI_DESCRIPTION,
      image,
    },
  };
}

export default function UiLayout({ children }: LayoutProps) {
  // First in the markup, so the framework moves it into <head> and switches it
  // off when a soft navigation leaves /ui (#1669).
  return html`
    <link rel="stylesheet" href=${asset('/ui.css')}>
    <div class="ui-site">
      ${children}
    </div>
  `;
}
