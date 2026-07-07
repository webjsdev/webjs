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
    <p class="text-fg-muted mb-4">A folder is a URL segment; a <code>[id]</code> folder is a dynamic param.</p>
    <ul class="list-disc pl-5">
      <li><a class="text-accent" href="/features/routing/42">/features/routing/42</a></li>
      <li><a class="text-accent" href="/features/routing/hello">/features/routing/hello</a></li>
    </ul>
  `;
}
