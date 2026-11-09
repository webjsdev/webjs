import { html, unsafeHTML, notFound, asset } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { FIXTURES, CHAT_QUESTION } from '#modules/ui/typeset/fixtures/index.server.ts';
import { coerce, parseParams, previewStyle, type ItemName } from '#modules/ui/typeset/params.ts';

/**
 * /ui/preview/typeset/<item>, the typeset builder's preview frame, ported
 * from shadcn/ui's apps/v4/app/(view)/preview/typeset/ (the layout and the
 * [name] page, #1666).
 *
 * It lives outside app/ui/(chrome), so it renders with no header or footer:
 * /ui/typeset shows it in an iframe, and "Open in New Tab" opens it bare.
 *
 * The settings arrive in the query string and are written at SSR as the
 * --preview-* custom properties on the frame's root (the same names shadcn's
 * preview provider sets), so the first paint is right with no script. When a
 * choice changes on /ui/typeset, the builder rewrites those properties in
 * this document (it is same-origin), so the frame never reloads for anything
 * but a new specimen. The page itself ships no script.
 *
 * The specimen is trusted static HTML from modules/ui/typeset/fixtures/,
 * shadcn's own, so unsafeHTML is the right tool, as dangerouslySetInnerHTML
 * is in shadcn's.
 */

export const metadata: Metadata = {
  title: 'Typeset Preview',
  robots: { index: false },
};

export default async function TypesetPreview({ params, searchParams }: PageProps) {
  const { name } = await params;
  if (coerce('item', name) === null) notFound();
  const settings = parseParams(await searchParams);
  const content = html`<div class="typeset w-full [--typeset-flow:var(--preview-flow)] [--typeset-leading:var(--preview-leading)]">${unsafeHTML(FIXTURES[name as ItemName])}</div>`;

  return html`
    <link rel="stylesheet" href=${asset('/typeset-fonts.css')}>
    <!-- The root layout reserves the fixed header's height on the body, and
         this frame has no header. -->
    <style>:root { --header-h: 0px; }</style>
    <div data-slot="typeset-preview" style=${previewStyle(settings)} class="flex min-h-svh justify-center bg-background px-6 pt-8 pb-24 [font-family:var(--preview-font)] [--font-heading:var(--preview-font-heading)] [--font-mono:var(--preview-font-mono)] md:pt-24 md:pb-32">
      <main class="w-full [font-size:var(--preview-size)] [max-width:var(--preview-measure)]">
        ${name === 'chat'
          ? html`<div class="flex w-full flex-col gap-10">
              <div class="ml-auto w-fit max-w-[65%] rounded-3xl bg-muted px-4 py-2.5">${CHAT_QUESTION}</div>
              ${content}
            </div>`
          : content}
      </main>
    </div>
  `;
}
