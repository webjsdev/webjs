import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';

/**
 * shadcn/ui's page header for the /ui section pages (#1666): PageHeader,
 * PageHeaderHeading, PageHeaderDescription and PageActions from
 * apps/v4/components/page-header.tsx, the Announcement badge above them, and
 * PageNav, the bar under the header that carries a section's own nav (the
 * blocks categories, the chart types).
 *
 * Fragments, in shadcn's classes. The badge renders in new-york, the style
 * shadcn's announcement imports, so it sits in its own `style-new-york`
 * wrapper (display: contents, so it adds no box).
 */

// lucide's arrow-right, which shadcn's announcement badge uses.
const arrowRight = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;

/** shadcn's Announcement: the release badge over a page header. */
export function announcement() {
  return html`<span class="style-new-york contents">
    <a href="/changelog" data-slot="badge" class=${cn(badgeClass({ variant: 'secondary' }), 'bg-muted no-underline')}>
      Sidebar, Carousel and Code Block ${arrowRight}
    </a>
  </span>`;
}

export interface UiPageHeaderOptions {
  title: string;
  description: string;
  /** PageActions: the buttons under the description. */
  actions?: unknown;
}

/** PageHeader with the announcement, the heading, the description and the actions. */
export function uiPageHeader(opts: UiPageHeaderOptions) {
  return html`<section class="border-grid">
    <div class="container-wrapper">
      <div class="container flex flex-col items-center gap-2 px-6 py-8 text-center md:py-16 lg:py-20 xl:gap-4">
        ${announcement()}
        <h1 class="leading-tighter max-w-3xl text-3xl font-semibold tracking-tight text-balance text-primary lg:leading-[1.1] lg:font-semibold xl:text-5xl xl:tracking-tighter">${opts.title}</h1>
        <p class="max-w-4xl text-base text-balance text-foreground sm:text-lg">${opts.description}</p>
        ${opts.actions
          ? html`<div class="flex w-full items-center justify-center gap-2 pt-2 **:data-[slot=button]:shadow-none">${opts.actions}</div>`
          : ''}
      </div>
    </div>
  </section>`;
}

/** PageNav: the bar under the header holding a section's own navigation. */
export function pageNav(content: unknown, opts: { id?: string; class?: string } = {}) {
  return html`<div id=${opts.id ?? null} class=${cn('container-wrapper scroll-mt-24', opts.class)}>
    <div class="container flex items-center justify-between gap-4 py-4">${content}</div>
  </div>`;
}
