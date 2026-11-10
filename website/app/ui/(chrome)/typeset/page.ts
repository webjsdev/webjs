import { html, asset } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { styleLinks } from '#lib/ui/style-links.ts';
import { parseParams } from '#modules/ui/typeset/params.ts';
import { customizer } from '#modules/ui/typeset/customizer.ts';
import { previewFrame } from '#modules/ui/typeset/preview-frame.ts';
import { docsPanel } from '#modules/ui/typeset/docs-panel.ts';
// The behaviour around the server's markup. A page never hydrates, so it
// imports the element to register it.
import '#components/typeset-customizer.ts';

/**
 * /ui/typeset, the typeset builder, ported from shadcn/ui's
 * apps/v4/app/(app)/(typeset)/typeset/page.tsx (#1666).
 *
 * shadcn's three panels in its layout and classes: the dark customizer on
 * the left, the framed preview in the middle, the Docs / Prompt panel on the
 * right (from xl up, and below that in the customizer's Get Code drawer).
 *
 * The state is the query string, shadcn's params with shadcn's defaults
 * (modules/ui/typeset/params.ts), parsed here, so every panel is right on the
 * first paint and a link to a typeset is a link to this page. The customizer
 * is a GET form, so the page works with JavaScript off. <typeset-customizer>
 * adds the instant apply, the shortcuts and the menus.
 *
 * Every part is in shadcn's base-nova look (`.style-nova`), except the
 * toolbar's pills, which shadcn imports from new-york-v4. Both styles are in
 * public/ui.css, so no extra stylesheet is linked (lib/ui/style-links.ts).
 *
 * `data-slot="designer"` is what app/ui/(chrome)/layout.ts keys on, as
 * shadcn's app layout does: the layout takes exactly the viewport and the
 * footer hides, so the three panels fill the screen.
 */

export const metadata: Metadata = {
  title: 'Typeset',
  description: 'Typography for markdown you don\'t control.',
};

export default async function TypesetPage({ url, searchParams }: PageProps) {
  const params = parseParams(await searchParams);
  const { origin } = new URL(url);
  return html`
    <link rel="stylesheet" href=${asset('/typeset-fonts.css')}>
    ${styleLinks('/ui/typeset')}
    <main id="main" tabindex="-1" class="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <typeset-customizer data-slot="designer" class="style-nova flex min-h-0 flex-1 flex-col items-start gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        ${docsPanel(params, origin)}
        ${previewFrame(params)}
        ${customizer(params, origin)}
      </typeset-customizer>
    </main>
  `;
}
