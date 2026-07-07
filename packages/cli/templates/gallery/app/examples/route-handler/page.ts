// webjs-scaffold-placeholder. Example gallery route. Keep and adapt it, or prune it (delete this app/examples/route-handler route, including its data/route.ts handler), then delete this marker line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Route handlers (route.ts) | examples' };

export default function RouteHandlerExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Route handlers</h1>
    <p class="text-fg-muted mb-4">A <code>route.ts</code> is a server-only HTTP endpoint (named <code>GET</code>/<code>POST</code>/... exports), the webjs equivalent of a Next route handler. It never ships to the client.</p>
    <p><a class="text-accent" href="/examples/route-handler/data">GET /examples/route-handler/data</a> returns JSON.</p>
  `;
}
