// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/caching route), then delete this marker line. webjs check fails while the marker remains.
// Caching: `export const revalidate = N` opts the page into the server HTML
// response cache, keyed by URL for N seconds. The rendered timestamp below only
// changes once per window: reload inside 10s and it is identical, reload after
// and it refreshes. SAFETY: only cache a page that is identical for every
// visitor (no cookies(), no session, no per-user data), since the key is the URL
// alone. For per-query reads use cache() + tags with revalidateTag; for assets
// use HTTP Cache-Control + ETag (conditional GET).
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Caching (revalidate) | features' };

// Cache this page's SSR HTML for 10 seconds.
export const revalidate = 10;

export default function CachingExample() {
  // Runs at render time, then the whole response is cached for `revalidate`
  // seconds, so this value is frozen until the window elapses.
  const renderedAt = new Date().toLocaleTimeString('en-US', { hour12: false });
  return html`
    <h1 class="text-h2 font-bold mb-4">Caching</h1>
    <p class="text-muted-foreground mb-4">
      This page sets <code>export const revalidate = 10</code>, so its
      server-rendered HTML is cached per URL for ten seconds.
    </p>
    <p class="mb-4">
      Rendered at
      <code class="font-mono text-accent">${renderedAt}</code>.
      Reload within 10s and this is unchanged; after 10s it re-renders.
    </p>
    <p class="text-muted-foreground text-sm">
      Only for pages identical for every visitor. For per-user or per-query data
      use <code>cache()</code> with <code>tags</code> and
      <code>revalidateTag</code>, or a GET action's
      <code>export const cache</code>.
    </p>
  `;
}
