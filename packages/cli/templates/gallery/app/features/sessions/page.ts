// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/sessions route AND modules/sessions), then delete this marker line. webjs check fails while the marker remains.
// Sessions: a per-segment middleware.ts applies session() (a signed cookie by
// default; store-backed for larger sessions), and a route.ts reads/writes it
// with getSession(req). Session state is per-user, so it lives on the server
// boundary (a route/middleware), never in a page/component that ships to the
// browser. See modules/sessions/session-config.server.ts.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Sessions (cookie + store) | features' };

export default function SessionsExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Sessions</h1>
    <p class="text-muted-foreground mb-4">A per-segment <code>middleware.ts</code> applies <code>session()</code>; a <code>route.ts</code> reads it with <code>getSession(req)</code>.</p>
    <p><a class="text-primary" href="/features/sessions/count">GET /features/sessions/count</a> increments a per-visitor counter kept in the signed session cookie. Reload it and the count climbs; open it in a private window and it starts over.</p>
    <p class="text-muted-foreground text-sm mt-3">Swap the storage from <code class="font-mono">cookieSession()</code> to <code class="font-mono">storeSession()</code> to hold larger sessions in the active store (Redis in production).</p>
  `;
}
