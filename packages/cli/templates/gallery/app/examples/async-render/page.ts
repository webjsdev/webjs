// webjs-scaffold-placeholder. Example gallery route. Keep and adapt it, or prune it (delete this app/examples/async-render route AND modules/async-render), then delete this marker line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/async-render/components/server-clock.ts';

export const metadata: Metadata = { title: 'Async render (server data in first paint) | examples' };

export default function AsyncRenderExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Async render</h1>
    <p class="text-fg-muted mb-4">A component's <code>async render()</code> awaits server data. SSR blocks, so the resolved value is in the first paint (no fallback, readable with JS off).</p>
    <server-clock></server-clock>
  `;
}
