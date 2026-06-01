import { html } from '@webjsdev/core';
import { listPosts } from '../../modules/posts/queries/list-posts.server.ts';

export const metadata = { title: 'Search posts' };

/**
 * Progressive-enhancement search. A plain native GET form: with JavaScript
 * the client router promotes it to a fragment swap, and with JavaScript
 * disabled the browser does a full navigation to `/search?q=...` and this
 * server-rendered page shows the results. It has no interactivity, so it
 * reads and works identically either way, which is exactly the no-JS
 * baseline the framework promises. The JS-disabled e2e layer (#183)
 * exercises this form as the canonical "a form submits and the server
 * renders the response with JS off" case.
 */
export default async function Search(
  { searchParams }: { searchParams?: { q?: string } },
) {
  const q = String(searchParams?.q || '').trim();
  const all = await listPosts();
  const results = q
    ? all.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))
    : [];
  return html`
    <section class="grid gap-6 max-w-2xl">
      <h1 class="text-2xl font-semibold tracking-tight">Search posts</h1>
      <form action="/search" method="get" class="flex gap-2">
        <input
          type="search"
          name="q"
          value=${q}
          placeholder="Search by title"
          aria-label="Search posts"
          class="flex-1 px-3 py-2 rounded-md border border-border bg-bg-elev text-fg"
        >
        <button type="submit" class="px-4 py-2 rounded-md bg-accent text-bg font-medium">Search</button>
      </form>
      ${q
        ? html`<p data-search-summary class="text-fg-muted text-sm">Found ${results.length} result${results.length === 1 ? '' : 's'} for "${q}".</p>`
        : html`<p data-search-summary class="text-fg-muted text-sm">Type a query and submit to search post titles.</p>`}
      <ul class="grid gap-2">
        ${results.map((p) => html`<li class="search-result"><a href="/blog/${p.slug}" class="text-accent no-underline hover:underline">${p.title}</a></li>`)}
      </ul>
    </section>
  `;
}
