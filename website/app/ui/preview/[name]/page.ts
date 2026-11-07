import { html, notFound, asset } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { unsafeHTML } from '@webjsdev/core/directives';
import { renderBlock } from '#modules/ui/queries/render-block.server.ts';
import { renderDemo } from '#modules/ui/queries/render-demo.server.ts';
import { ITEM_NAME, PREVIEW_ITEMS, parseCreateParams } from '#modules/ui/create/params.ts';
import { designSystemClass, designSystemData, designSystemStyle, menuColorCss } from '#modules/ui/create/design-system.ts';
import { previewPlaceholder } from '#modules/ui/create/placeholder.ts';
// The custom elements the blocks define (the preview cards' waveform, roller
// shades, notification settings, chat player). The block renders here as a
// string, so its own modules never load in the browser; this generated barrel
// (scripts/copy-registry.mjs) registers them, as app/ui/view/[name]/page.ts does.
import '#modules/ui/blocks/elements.ts';

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
 * is same-origin), so the frame never reloads for a design choice. What ships
 * is the blocks' own elements (the barrel below) and public/ui-menu-color.js,
 * which puts the translucent menu class on menus as they open (an inverted
 * menu is the CSS rule below, on the wrapper's `data-menu-color`).
 *
 * The content is a block (the preview set, or any block the item explorer
 * lists) through the block viewer's render query, or a component's demo
 * (`<name>-demo`) through the docs' render query. A preview block that is not
 * in the registry yet shows a board of kit components
 * (modules/ui/create/placeholder.ts).
 */

export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false },
};

export default async function CreatePreview({ params, searchParams }: PageProps) {
  const { name } = await params;
  if (!ITEM_NAME.test(name)) notFound();
  const { config } = parseCreateParams(await searchParams);
  const isPreview = PREVIEW_ITEMS.some((item) => item.value === name);
  // A preview block that fails to render (one landing file by file) shows
  // the placeholder, and says why in the server log.
  const block = await renderBlock(name).catch((err: unknown) => {
    console.error(`[ui/preview] ${name} did not render${isPreview ? ', showing the placeholder' : ''}:`, err);
    return null;
  });
  const demo = block || isPreview ? null : await renderDemo(name);
  if (!block && !demo && !isPreview) notFound();
  const data = designSystemData(config);
  const content = block
    ? unsafeHTML(block.html)
    : demo
      ? html`<div class="flex min-h-svh items-center justify-center p-6 md:p-10"><div class="w-full max-w-md">${unsafeHTML(demo.html)}</div></div>`
      : previewPlaceholder(name);

  return html`
    <link rel="stylesheet" href=${asset('/public/typeset-fonts.css')}>
    <link rel="stylesheet" href=${asset('/public/create-fonts.css')}>
    <!-- The root layout reserves the fixed header's height on the body, and
         this frame has no header. -->
    <style>:root { --header-h: 0px; } ${menuColorCss()}</style>
    <div data-slot="design-system" data-item=${name} data-menu-color=${data.menuColor} data-style=${data.style} data-radius=${data.radius} data-font=${data.font} data-font-heading=${data.fontHeading} data-style-title=${data.styleTitle} data-font-title=${data.fontTitle} data-font-heading-title=${data.fontHeadingTitle} data-font-heading-label=${data.fontHeadingLabel} class=${designSystemClass(config)} style=${designSystemStyle(config)}>
      ${content}
    </div>
    <script src=${asset('/public/ui-menu-color.js')} defer></script>
  `;
}
