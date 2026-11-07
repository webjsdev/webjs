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
import { ExternalLinkIcon, FileSearchIcon } from '../../../lib/icons.ts';

export type SourcePart =
  | { type: 'source-url'; sourceId: string; url: string; title?: string }
  | { type: 'source-document'; sourceId: string; mediaType: string; title?: string; filename?: string };

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
