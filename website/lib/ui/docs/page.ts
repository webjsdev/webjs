import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { neighbours } from '#modules/ui/docs/nav.ts';
import { styleLinks } from '#lib/ui/style-links.ts';
import { uiMarkdownHref } from '#lib/ui/llm-path.ts';
import { siteUrl } from '#lib/env.ts';
// The Copy Page button and the code blocks' copy buttons (lib/ui/docs/code.ts).
// A page never hydrates, so the shell its markup lives in registers them.
import '#components/docs-copy-page.ts';
import '#components/docs-copy-code.ts';

/**
 * The frame of every /ui docs page, shadcn's apps/v4/app/(app)/docs/[[...slug]]/page.tsx
 * (#1666): the title row with the previous and next buttons, the
 * description, the body in shadcn's `typeset` prose styles, the previous and
 * next links at the foot, and the "On This Page" column.
 *
 * The table of contents is read from the body's own `<h2 id>` / `<h3 id>`
 * headings (see `heading()`), so it cannot list a heading the page lacks.
 * shadcn's base switcher has no WebJs counterpart (D8), so its slot is left
 * out, and the column under the table of contents is WebJs's own card.
 */

export interface TocEntry {
  id: string;
  title: string;
  depth: 2 | 3;
}

/** The anchor id for a heading's text, as shadcn's getHeadingId slugs it. */
export function slug(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

const arrow = (d: string) => html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${d}></path></svg>`;
const LEFT = 'M5 12l14 0 M5 12l6 6 M5 12l6 -6';
const RIGHT = 'M5 12l14 0 M13 18l6 -6 M13 6l6 6';

/**
 * A docs heading with shadcn's anchor link, recorded in `toc` so the page's
 * table of contents lists it. A slug the page already used gets a `-1`, `-2`
 * suffix, github-slugger's rule (shadcn slugs its headings with rehype-slug),
 * so "FieldSet" and "Fieldset" on one page are two anchors, not one id twice.
 */
export function heading(toc: TocEntry[], depth: 2 | 3, title: string, base = slug(title)) {
  let id = base;
  for (let n = 1; toc.some((e) => e.id === id); n++) id = `${base}-${n}`;
  toc.push({ id, title, depth });
  const inner = html`<a href=${`#${id}`} class="no-underline">${title}</a>`;
  return depth === 2 ? html`<h2 id=${id}>${inner}</h2>` : html`<h3 id=${id}>${inner}</h3>`;
}

function toc(entries: TocEntry[]) {
  if (!entries.length) return '';
  return html`
    <div class="flex scroll-fade scrollbar-none flex-col gap-8 overflow-y-auto px-8">
      <nav aria-label="On this page" class="flex flex-col gap-2 p-4 pt-0 text-sm">
        <p class="sticky top-0 h-6 bg-background text-xs font-medium text-muted-foreground">On This Page</p>
        ${entries.map((e) => html`<a href=${`#${e.id}`} data-depth=${e.depth} class="text-[0.8rem] text-muted-foreground no-underline transition-colors hover:text-foreground data-[depth=3]:pl-4">${e.title}</a>`)}
      </nav>
    </div>`;
}

export function docsPage(opts: { href: string; title: string; description?: string; body: unknown; toc?: TocEntry[] }) {
  const { previous, next } = neighbours(opts.href);
  const iconButton = cn(buttonClass({ variant: 'secondary', size: 'icon' }), 'extend-touch-target size-8 shadow-none no-underline md:size-7');
  const textButton = cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'shadow-none no-underline');
  // The page as markdown (app/ui/llm), for shadcn's DocsCopyPage: Copy Page
  // and its menu, which shadcn hides below sm. With JS off a plain View as
  // Markdown link stands in for it.
  const markdown = uiMarkdownHref(opts.href);
  return html`
    ${styleLinks(opts.href)}
    <main id="main" data-slot="docs" class="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="h-(--top-spacing) shrink-0"></div>
        <div class="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8">
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between md:items-start">
              <h1 class="scroll-m-24 text-3xl font-semibold tracking-tight sm:text-3xl">${opts.title}</h1>
              <div class="docs-nav flex items-center gap-2">
                ${markdown ? html`<div class="hidden sm:block">
                  <docs-copy-page href=${markdown} url=${siteUrl() + opts.href}></docs-copy-page>
                </div>` : ''}
                <div class="ml-auto flex gap-2">
                  ${previous ? html`<a href=${previous.href} data-slot="button" class=${iconButton}>${arrow(LEFT)}<span class="sr-only">Previous</span></a>` : ''}
                  ${next ? html`<a href=${next.href} data-slot="button" class=${iconButton}><span class="sr-only">Next</span>${arrow(RIGHT)}</a>` : ''}
                </div>
              </div>
            </div>
            ${opts.description ? html`<p data-slot="docs-description" class="text-[1.05rem] text-muted-foreground sm:text-base sm:text-balance md:max-w-[80%]">${opts.description}</p>` : ''}
          </div>
          <div data-slot="docs-body" class="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">${opts.body}</div>
          <div class="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
            ${previous ? html`<a href=${previous.href} data-slot="button" class=${textButton}>${arrow(LEFT)} ${previous.title}</a>` : ''}
            ${next ? html`<a href=${next.href} data-slot="button" class=${cn(textButton, 'ml-auto')}>${next.title} ${arrow(RIGHT)}</a>` : ''}
          </div>
        </div>
      </div>
      <div class="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div class="h-(--top-spacing) shrink-0"></div>
        ${toc(opts.toc ?? [])}
      </div>
    </main>`;
}
