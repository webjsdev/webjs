import { html } from '@webjsdev/core';
import { unsafeHTML } from '@webjsdev/core/directives';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { listEntries } from '#modules/changelog/queries/list-entries.server.ts';
import { renderEntryBody } from '#modules/changelog/utils/render-entry.ts';

/**
 * Changelog, ported from shadcn's app/(app)/docs/changelog/page.tsx (#1666):
 * the latest releases in full, one article each, then the older ones as a
 * grid of cards under More Updates. The entries are WebJs UI's own, the
 * changelog/ui/*.md files the release workflow writes (the same feed
 * /changelog shows for every package), never shadcn's history.
 */
export const title = 'Changelog';
export const description = 'Latest updates and announcements.';

const NUMBER_OF_LATEST_PAGES = 5;

/**
 * The rendered body without the marketing site's own classes. They name
 * tokens the /ui stylesheet does not carry (text-fg, bg-fg/8) or carries with
 * another meaning (text-accent is the kit's hover surface), so every class
 * goes except the depth insets, and the typeset wrapper styles the elements.
 */
function entryHtml(md: string): string {
  return renderEntryBody(md).replace(/ class="([^"]*)"/g, (_m, cls: string) => {
    const kept = cls.split(/\s+/).filter((c) => c === 'pl-4' || c === 'pl-8');
    return kept.length ? ` class="${kept.join(' ')}"` : '';
  });
}

function date(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default async function body(toc: TocEntry[]) {
  const entries = (await listEntries()).filter((e) => e.shortPkg === 'ui');
  const latest = entries.slice(0, NUMBER_OF_LATEST_PAGES);
  const older = entries.slice(NUMBER_OF_LATEST_PAGES);

  return html`
    <p>Latest updates and announcements for WebJs UI, the <code>@webjsdev/ui</code> package. Each release writes one entry, automatically, from the changes merged since the last one. The <a href="/changelog">WebJs changelog</a> lists every package.</p>
    ${latest.map((e) => html`
      <article class="mb-12 border-b pb-12">
        ${heading(toc, 2, e.package + ' ' + e.version, 'v' + e.version.replace(/\./g, '-'))}
        <p class="text-sm text-muted-foreground"><time datetime=${e.date}>${date(e.date)}</time></p>
        ${unsafeHTML(entryHtml(e.body))}
      </article>`)}
    ${older.length ? html`
      ${heading(toc, 2, 'More Updates')}
      <div class="not-typeset mt-6 mb-24 grid auto-rows-fr gap-3 sm:grid-cols-2">
        ${older.map((e) => html`
          <a href="/changelog" class="flex w-full flex-col rounded-2xl bg-surface px-4 py-3 text-surface-foreground no-underline transition-colors hover:bg-surface/80">
            <span class="text-xs text-muted-foreground">${date(e.date)}</span>
            <span class="text-sm font-medium">${e.package} ${e.version}</span>
          </a>`)}
      </div>` : ''}
  `;
}
