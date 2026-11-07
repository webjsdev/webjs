import { html, notFound, cspNonce, asset } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { unsafeHTML } from '@webjsdev/core/directives';
import { styleLink } from '#lib/ui/style-links.ts';
import { renderBlock } from '#modules/ui/queries/render-block.server.ts';
import { renderDemo } from '#modules/ui/queries/render-demo.server.ts';
// The custom elements the blocks define. The block renders here as a string,
// so its own modules never load in the browser; this generated barrel
// (scripts/copy-registry.mjs) registers them, as app/ui/layout.ts registers the
// kit's.
import '#modules/ui/blocks/elements.ts';
// Submits a demo's language select on change (the RTL sidebar's selector).
import '#modules/ui/example-apps/example-bind.ts';

/**
 * /ui/view/<name>, one registry block rendered full screen, ported from
 * shadcn/ui's apps/v4/app/(view)/view/[style]/[name]/page.tsx (#1666, D18).
 *
 * It lives outside app/ui/(chrome), so it renders with no header or footer:
 * the block viewer on /ui/blocks shows it in an iframe, and "Open in New Tab"
 * opens it bare. The kit's elements are registered by app/ui/layout.ts, as on
 * every /ui page. The block renders in new-york, the style shadcn's blocks
 * render in.
 *
 * A block's forms carry no action yet (its source says to bind one), so a
 * submit here would GET this page with the typed values in the URL. The inline
 * script cancels any submit inside the frame, which keeps the preview inert
 * without touching the block's source. The router honours a cancelled submit,
 * so it never posts either. With JavaScript off the form submits as the
 * installed block would. A demo's own GET form (the RTL sidebar's language
 * selector, `data-view-submit`) is the one that is let through.
 */

/**
 * The docs demos that are whole pages, linked from a docs page to open full
 * screen (shadcn's "View RTL Sidebar"). Any other demo stays a 404 here, so
 * this route keeps serving blocks and nothing a block viewer cannot show.
 */
const FULL_SCREEN_DEMOS = new Set(['sidebar-rtl']);

/** The `?lang=` a full-screen demo renders in, when one is given. */
function langOf(searchParams: Record<string, string | string[] | undefined>): string | undefined {
  const lang = searchParams.lang;
  return typeof lang === 'string' ? lang : undefined;
}

export async function generateMetadata({ params, searchParams }: PageProps<'/ui/view/[name]'>) {
  const block = await renderBlock(params.name);
  const demo = block || !FULL_SCREEN_DEMOS.has(params.name) ? null : await renderDemo(params.name, { lang: langOf(await searchParams) });
  return { title: block ? `${block.title} | WebJs UI` : demo ? `${params.name} | WebJs UI` : 'WebJs UI', robots: { index: false } };
}

export default async function BlockView({ params, searchParams }: PageProps<'/ui/view/[name]'>) {
  const block = await renderBlock(params.name);
  // A whole-page docs demo (the sidebar's RTL view) renders here too, as
  // shadcn's view route renders an example by name, in nova like the docs,
  // in the language its `?lang=` names.
  const demo = block || !FULL_SCREEN_DEMOS.has(params.name) ? null : await renderDemo(params.name, { lang: langOf(await searchParams) });
  if (!block && !demo) notFound();
  return html`
    <!-- The root layout reserves the fixed header's height on the page body, and
         this frame has no header. -->
    <style>:root { --header-h: 0px; }</style>
    ${demo ? html`<link rel="stylesheet" href=${asset('/public/rtl-fonts.css')}>${styleLink('nova')}` : ''}
    <div data-slot="block-view" data-block=${params.name} class=${block ? 'style-new-york bg-background' : 'style-nova bg-background'}>
      ${unsafeHTML(block ? block.html : demo!.html)}
    </div>
    <script nonce=${cspNonce()}>
      (function(){
        if (window.__wjBlockViewInert) return;
        window.__wjBlockViewInert = true;
        document.addEventListener('submit', function(e){
          if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-view-submit')) return;
          e.preventDefault();
        }, true);
      })();
    </script>
  `;
}
