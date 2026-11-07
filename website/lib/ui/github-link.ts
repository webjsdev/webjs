import { html } from '@webjsdev/core';
import { GH_URL, NEW_TAB } from '#lib/links.ts';

/**
 * The /ui header's GitHub link, shadcn's GitHubLink
 * (apps/v4/components/github-link.tsx): the mark and, when the server could
 * read it, the star count (modules/ui/queries/github-stars.server.ts). With
 * no count the link is the mark alone, where shadcn shows a skeleton while
 * its Suspense boundary waits; a server render that already gave up on
 * GitHub has nothing to wait for.
 */

/** shadcn's format: whole thousands as "12k", smaller counts in full. */
export function formatStars(count: number): string {
  return count >= 1000 ? `${Math.round(count / 1000)}k` : count.toLocaleString('en-US');
}

const githubIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true" class="size-4 fill-current"><path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3"/></svg>`;

export function githubLink(stars: number | null) {
  return html`<a data-slot="button" href=${GH_URL} target="_blank" rel="noreferrer" class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-foreground no-underline shadow-none outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50">${githubIcon}<span class="sr-only">GitHub</span>${stars === null ? '' : html`<span data-github-stars class="w-fit text-xs text-muted-foreground tabular-nums">${formatStars(stars)}</span>`}${NEW_TAB}</a>`;
}
