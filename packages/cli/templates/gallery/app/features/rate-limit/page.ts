// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/rate-limit route AND modules/rate-limit), then delete this marker line. webjs check fails while the marker remains.
// Rate limiting: rateLimit() from '@webjsdev/server' is a middleware. It lives in
// a middleware.ts scoped to the endpoint it protects (here app/features/
// rate-limit/ping/middleware.ts, so it limits /features/rate-limit/ping WITHOUT
// touching this page). It is backed by the pluggable cache store, in-memory by
// default; point the store at Redis to share the window across instances.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/rate-limit/components/rate-probe.ts';

export const metadata: Metadata = { title: 'Rate limiting (rateLimit middleware) | features' };

export default function RateLimitExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Rate limiting</h1>
    <p class="text-muted-foreground mb-4">
      The <code class="font-mono">/ping</code> endpoint is limited to five
      requests per ten seconds by a scoped <code class="font-mono">middleware.ts</code>.
      Ping past the limit to get a <code class="font-mono">429</code> with a
      <code class="font-mono">Retry-After</code> header.
    </p>
    <rate-probe></rate-probe>
    <p class="text-muted-foreground text-sm mt-4">
      With JavaScript off, hit
      <a class="text-primary" href="/features/rate-limit/ping" data-no-router>/features/rate-limit/ping</a>
      directly (refresh past five times in ten seconds).
    </p>
  `;
}
