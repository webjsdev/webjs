// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/components route AND modules/components), then delete this marker line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/components/components/counter-card.ts';
import '#modules/components/components/reactive-meter.ts';

export const metadata: Metadata = { title: 'Components (signals + slots) | features' };

export default function ComponentsExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Components</h1>
    <p class="text-muted-foreground mb-4">The WebComponent factory, a reactive prop, an instance signal, and a slot.</p>
    <counter-card label="Taps"><strong>A slotted title</strong></counter-card>
    <p class="text-muted-foreground mt-6 mb-2">Shadow DOM (scoped <code class="font-mono">css</code>) plus the rest of the signals API (<code class="font-mono">computed</code>, <code class="font-mono">effect</code>, <code class="font-mono">batch</code>):</p>
    <reactive-meter></reactive-meter>
  `;
}
