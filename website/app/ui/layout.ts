import { html, asset } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';

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
 *   they never leak into a marketing page. It also carries the kit STYLE the
 *   components render in (`style-new-york` for now, the kit's default look),
 *   because the registry components are in base form and take their look
 *   from a `.style-<name>` ancestor (#1666, D8).
 * - the /ui stylesheet link. The root layout already emits it in <head> on a
 *   full load of a /ui page. This copy covers a SOFT navigation into /ui from
 *   a marketing page, where the root layout is not re-rendered and the
 *   router's head merge only adds. The same URL twice costs one fetch.
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
  const image = `${origin}/public/og.png`;
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
  return html`
    <link rel="stylesheet" href=${asset('/public/ui.css')}>
    <div class="ui-site style-new-york">
      ${children}
    </div>
  `;
}
