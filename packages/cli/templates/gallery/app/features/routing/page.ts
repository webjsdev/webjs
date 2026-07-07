// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/routing route), then delete this marker line. webjs check fails while the marker remains.
// Routing basics: a static page that links to a dynamic route. app/ is routing
// only; a folder maps to a URL segment, and [id] is a dynamic segment read from
// `params`. See app/features/routing/[id]/page.ts.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = { title: 'Routing (dynamic params) | features' };

export default function RoutingExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Routing</h1>
    <p class="text-muted-foreground mb-4">A folder is a URL segment; a <code>[id]</code> folder is a dynamic param.</p>
    <ul class="list-disc pl-5 mb-4">
      <li><a class="text-accent" href="/features/routing/42">/features/routing/42</a></li>
      <li><a class="text-accent" href="/features/routing/hello">/features/routing/hello</a></li>
    </ul>
    <p class="text-muted-foreground text-sm">
      Routes are type-safe: <code class="font-mono">webjs types</code> (run by
      <code class="font-mono">webjs dev</code>) generates a
      <code class="font-mono">Route</code> union, and the
      <code class="font-mono">[id]</code> page types its props with
      <code class="font-mono">PageProps&lt;'/features/routing/[id]'&gt;</code>
      so <code class="font-mono">params</code> is checked against the real routes.
    </p>
  `;
}
