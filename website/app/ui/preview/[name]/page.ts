import { html, notFound, asset } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { unsafeHTML } from '@webjsdev/core/directives';
import { renderBlock } from '#modules/ui/queries/render-block.server.ts';
import { PREVIEW_ITEMS, parseCreateParams } from '#modules/ui/create/params.ts';
import { designSystemClass, designSystemStyle, styleSheetHref } from '#modules/ui/create/design-system.ts';
import { previewPlaceholder } from '#modules/ui/create/placeholder.ts';

/**
 * /ui/preview/<name>, the /ui/create configurator's preview frame, shadcn's
 * apps/v4/app/(view)/preview/[base]/[name] (#1666). shadcn's base axis has
 * no WebJs counterpart (D8), so the route is one level shorter.
 *
 * It lives outside app/ui/(chrome), so it renders with no header: /ui/create
 * shows it in an iframe, and "Open in New Tab" opens it bare.
 *
 * The design system arrives as `?preset=<code>` and is written at SSR on the
 * `data-slot="design-system"` wrapper: the style's class, and the theme, the
 * radius and the fonts as custom properties. When a choice changes on
 * /ui/create, <create-customizer> rewrites that wrapper in this document (it
 * is same-origin), so the frame never reloads for a design choice. The page
 * itself ships no script.
 *
 * The content is the preview block of that name, rendered through the same
 * query the block viewer uses. Until the preview blocks are in the registry
 * it is a board of kit components (modules/ui/create/placeholder.ts).
 */

export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false },
};

export default async function CreatePreview({ params, searchParams }: PageProps) {
  const { name } = await params;
  if (!PREVIEW_ITEMS.some((item) => item.value === name)) notFound();
  const { config } = parseCreateParams(await searchParams);
  // A preview block that fails to render (one landing file by file) shows
  // the placeholder, and says why in the server log.
  const block = await renderBlock(name).catch((err: unknown) => {
    console.error(`[ui/preview] ${name} did not render, showing the placeholder:`, err);
    return null;
  });
  const sheet = styleSheetHref(config.style);

  return html`
    <link rel="stylesheet" href=${asset('/public/typeset-fonts.css')}>
    ${sheet ? html`<link rel="stylesheet" href=${asset(sheet)} data-style-sheet=${config.style}>` : ''}
    <!-- The root layout reserves the fixed header's height on the body, and
         this frame has no header. -->
    <style>:root { --header-h: 0px; }</style>
    <div data-slot="design-system" data-item=${name} class=${designSystemClass(config)} style=${designSystemStyle(config)}>
      ${block ? unsafeHTML(block.html) : previewPlaceholder(name)}
    </div>
  `;
}
