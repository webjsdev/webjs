import { html, unsafeHTML } from '@webjsdev/core';
import { listEntries } from '../../modules/changelog/queries/list-entries.server.ts';
import { renderEntryBody } from '../../modules/changelog/utils/render-entry.ts';
import { pkgBadge } from '../../modules/changelog/utils/pkg-badge.ts';

/**
 * /changelog
 *
 * Thin route adapter. File-reading, frontmatter parsing, body
 * rendering, and the package badge all live in
 * `modules/changelog/`. This page composes them.
 */

export const metadata = {
  title: 'Changelog · webjs',
  description: 'Per-package, per-version release notes for the webjs framework: @webjsdev/core, server, cli, ts-plugin, ui.',
};

export default async function Changelog() {
  const entries = await listEntries();
  return html`
    <main id="main" tabindex="-1" class="max-w-[840px] mx-auto px-6 py-12 focus:outline-none">
      <header class="mb-10">
        <p class="font-mono text-[11px] uppercase tracking-[0.15em] text-accent font-semibold mb-2">Changelog</p>
        <h1 class="font-serif text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-tight text-fg mb-3">What shipped</h1>
        <p class="text-fg-muted text-[15px] leading-relaxed max-w-[640px]">
          Per-package, per-version release notes for <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">@webjsdev/core</code>,
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/server</code>,
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/cli</code>,
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/ts-plugin</code>, and
          <code class="font-mono text-[13px] bg-bg-subtle px-1 py-0.5 rounded">/ui</code>.
          Each version-bump produces one entry, automatically.
        </p>
      </header>

      ${entries.length === 0
        ? html`<p class="text-fg-subtle italic">No entries yet.</p>`
        : entries.map((e) => html`
            <article class="border border-border rounded-xl bg-bg-elev p-5 sm:p-6 mb-5 shadow-sm">
              <header class="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                ${pkgBadge(e.shortPkg)}
                <h2 class="font-mono text-[18px] font-semibold text-fg tracking-tight m-0">v${e.version}</h2>
                <time class="font-mono text-[11.5px] text-fg-subtle tracking-tight">${e.date.slice(0, 10)}</time>
                <span class="text-[11.5px] text-fg-subtle">${e.commitCount} change${e.commitCount === 1 ? '' : 's'}</span>
              </header>
              <div>${unsafeHTML(renderEntryBody(e.body))}</div>
            </article>
          `)}
    </main>
  `;
}
