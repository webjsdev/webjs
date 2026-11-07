import { html, notFound, cspNonce } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { unsafeHTML } from '@webjsdev/core/directives';
import { renderBlock } from '#modules/ui/queries/render-block.server.ts';
// The custom elements the blocks define. The block renders here as a string,
// so its own modules never load in the browser; this generated barrel
// (scripts/copy-registry.mjs) registers them, as app/ui/layout.ts registers the
// kit's.
import '#modules/ui/blocks/elements.ts';

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
 * installed block would.
 */

export async function generateMetadata({ params }: PageProps<'/ui/view/[name]'>) {
  const block = await renderBlock(params.name);
  return { title: block ? `${block.title} | WebJs UI` : 'WebJs UI', robots: { index: false } };
}

export default async function BlockView({ params }: PageProps<'/ui/view/[name]'>) {
  const block = await renderBlock(params.name);
  if (!block) notFound();
  return html`
    <!-- The root layout reserves the fixed header's height on the page body, and
         this frame has no header. -->
    <style>:root { --header-h: 0px; }</style>
    <div data-slot="block-view" data-block=${params.name} class="style-new-york bg-background">
      ${unsafeHTML(block.html)}
    </div>
    <script nonce=${cspNonce()}>
      (function(){
        if (window.__wjBlockViewInert) return;
        window.__wjBlockViewInert = true;
        document.addEventListener('submit', function(e){ e.preventDefault(); }, true);
      })();
    </script>
  `;
}
