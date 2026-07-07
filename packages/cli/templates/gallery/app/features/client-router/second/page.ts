// webjs-scaffold-placeholder. Feature gallery route (client-router page two). Pruned together with the parent app/features/client-router route. Delete this marker line once you adapt or remove it. webjs check fails while the marker remains.
// The soft-navigation target for the client-router demo. A plain page: the
// router needs no per-page code. The browser Back button restores this page and
// its scroll position from the client-router snapshot cache.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Client router: page two | features' };

export default function ClientRouterSecond() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Page two</h1>
    <p class="text-muted-foreground mb-4">
      You arrived here without a full reload. Press the browser Back button (or
      the link below): the previous page and its scroll position are restored
      from the snapshot cache.
    </p>
    <a href="/features/client-router" class="text-accent no-underline font-medium">&larr; Back to page one</a>
  `;
}
