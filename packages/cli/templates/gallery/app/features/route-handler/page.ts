// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/route-handler route, including its data/route.ts handler), then delete this marker line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/route-handler/components/rich-data.ts';

export const metadata: Metadata = { title: 'Route handlers (route.ts) | features' };

export default function RouteHandlerExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Route handlers</h1>
    <p class="text-muted-foreground mb-4">A <code>route.ts</code> is a server-only HTTP endpoint (named <code>GET</code>/<code>POST</code>/... exports), the WebJs equivalent of a Next route handler. It never ships to the client.</p>
    <p>GET <a class="text-primary" href="/features/route-handler/data">/features/route-handler/data</a> returns rich JSON via <code class="font-mono">json()</code>.</p>
    <p class="text-muted-foreground mt-6 mb-2">A client component reading it with <code class="font-mono">richFetch</code>, so <code class="font-mono">at</code> comes back as a real <code class="font-mono">Date</code>:</p>
    <rich-data></rich-data>
  `;
}
