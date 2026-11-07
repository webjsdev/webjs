/**
 * The preview-03 source part: a source an assistant cited, either a url (a
 * link with its title and host) or a document (its title, file name, media
 * type and source id). A fragment helper, rendered by the server.
 *
 * Installed by `npx @webjsdev/ui add preview-03` at
 * `components/preview-03/part-source.ts`. Ported from shadcn/ui's preview-03.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { badgeClass } from '../../../components/badge.ts';

export type SourcePart =
  | { type: 'source-url'; sourceId: string; url: string; title?: string }
  | { type: 'source-document'; sourceId: string; mediaType: string; title?: string; filename?: string };

const ExternalLinkIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`;
const FileSearchIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><circle cx="11.5" cy="14.5" r="2.5"></circle><path d="M13.3 16.3 15 18"></path></svg>`;

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function partSource(opts: { part: SourcePart; class?: string }) {
  const { part } = opts;
  const icon = 'flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground';
  if (part.type === 'source-url') {
    return html`<a data-slot="part-source" data-type=${part.type} href=${part.url} target="_blank" rel="noreferrer" class=${cn('flex w-full max-w-full min-w-0 items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm transition-colors hover:bg-muted', opts.class)}>
      <span class=${icon}>${ExternalLinkIcon('size-4')}</span>
      <span class="min-w-0 flex-1">
        <span class="block truncate font-medium">${part.title ?? part.url}</span>
        <span class="block truncate text-xs text-muted-foreground">${hostname(part.url)}</span>
      </span>
      <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'shrink-0')}>URL</span>
    </a>`;
  }
  return html`<div data-slot="part-source" data-type=${part.type} class=${cn('flex w-full max-w-full min-w-0 items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm', opts.class)}>
    <span class=${icon}>${FileSearchIcon('size-4')}</span>
    <span class="min-w-0 flex-1">
      <span class="block truncate font-medium">${part.title ?? part.filename ?? 'Document source'}</span>
      <span class="mt-0.5 block truncate text-xs text-muted-foreground">${[part.filename, part.mediaType].filter(Boolean).join(' / ')}</span>
      <span class="mt-2 block text-xs text-muted-foreground">Source ID: ${part.sourceId}</span>
    </span>
    <span data-slot="badge" data-variant="outline" class=${cn(badgeClass({ variant: 'outline' }), 'shrink-0')}>Document</span>
  </div>`;
}
