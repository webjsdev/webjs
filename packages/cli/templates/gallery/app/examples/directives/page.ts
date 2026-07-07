// webjs-scaffold-placeholder. Example gallery route. Keep and adapt it, or prune it (delete this app/examples/directives route AND modules/directives), then delete this marker line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/directives/components/directive-demo.ts';

export const metadata: Metadata = { title: 'Directives (repeat + watch) | examples' };

export default function DirectivesExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Directives</h1>
    <p class="text-fg-muted mb-4">The lit-html directive set: <code>repeat</code> keys a reordering list so nodes are reused, and <code>watch(signal)</code> swaps one node without a full re-render.</p>
    <directive-demo></directive-demo>
  `;
}
