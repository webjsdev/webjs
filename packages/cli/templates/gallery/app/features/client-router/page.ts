// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/client-router route AND its second/ subpage), then delete this marker line. webjs check fails while the marker remains.
// Client router: automatic. It auto-enables the moment @webjsdev/core loads in
// the browser (the bundle every component pulls, so any page with a component
// gets it for free). There is nothing to import. An <a href> to another page
// does a soft navigation: the framework fetches only the divergent fragment
// (via the X-Webjs-Have header), swaps it in place, and restores scroll on
// back/forward. Links prefetch on hover by default. It degrades perfectly: with
// JS off, every link is a normal full-page navigation.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Client router (soft nav) | features' };

export default function ClientRouterExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Client router</h1>
    <p class="text-muted-foreground mb-4">
      Navigate to the second page and back. With JS on it is a soft swap (no full
      reload, scroll restored); open the network tab to see only a fragment
      fetched, prefetched on hover. With JS off the same links do full-page
      navigations. Nothing was imported to get this.
    </p>
    <div class="flex gap-3 items-center">
      <a href="/features/client-router/second" class="inline-flex items-center px-4 py-2 rounded-xl bg-accent text-accent-foreground font-semibold text-sm no-underline transition-all hover:bg-accent/90 active:scale-[0.97]">Go to page two</a>
      <a href="/" class="text-muted-foreground no-underline font-medium text-sm hover:text-foreground transition-colors">Home</a>
    </div>
    <p class="text-muted-foreground text-sm mt-6">
      Opt out app-wide with <code class="font-mono">{ "webjs": { "clientRouter": false } }</code>,
      or per-link with <code class="font-mono">data-no-router</code> (use it for
      auth flows like <code class="font-mono">/logout</code> that must reset
      in-memory state).
    </p>
  `;
}
