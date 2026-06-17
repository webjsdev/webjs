import { html } from '@webjsdev/core';
import '#/components/slot-card.ts';
import '#/components/slot-card-shadow.ts';

export const metadata = { title: 'Slot Demo' };

/**
 * /slot-demo page. Exercises the light-DOM <slot-card> component for
 * the e2e test suite. Three cards demonstrate the slot projection
 * surface: full projection (all three slots populated), partial
 * projection (only header + body, footer falls back), and a dynamic
 * input inside the body slot so the e2e test can verify that hydration
 * preserves form-control state.
 */
export default function SlotDemo() {
  return html`
    <section class="grid gap-6 max-w-3xl mx-auto py-12 px-4">
      <h1 class="text-2xl font-semibold">Slot demo</h1>

      <slot-card id="card-full" data-testid="full">
        <h2 slot="header">Full card</h2>
        <p>This body has authored children projected into the default slot.</p>
        <p>Multiple paragraphs survive.</p>
        <button slot="footer" id="footer-btn">Footer action</button>
      </slot-card>

      <slot-card id="card-partial" data-testid="partial">
        <h2 slot="header">Partial card</h2>
        <p>Footer slot below should show fallback content.</p>
      </slot-card>

      <slot-card id="card-input" data-testid="input">
        <h2 slot="header">Form survival</h2>
        <p>Type into the input then navigate away and back. The value
        should be preserved through hydration via DOM identity.</p>
        <input id="survive-input" type="text" class="mt-2 rounded border border-border bg-bg-subtle px-2 py-1" />
      </slot-card>

      <h2 class="mt-8 text-xl font-semibold">Shadow-DOM parity</h2>
      <p class="text-sm text-fg-muted">Identical render templates, just with <code>static shadow = true</code>.</p>

      <slot-card-shadow id="card-shadow-full" data-testid="shadow-full">
        <h2 slot="header">Shadow full card</h2>
        <p>Authored children rendered through native browser slot projection.</p>
        <button slot="footer" id="shadow-footer-btn">Shadow footer</button>
      </slot-card-shadow>

      <slot-card-shadow id="card-shadow-partial" data-testid="shadow-partial">
        <h2 slot="header">Shadow partial card</h2>
        <p>Footer slot should show the shadow-tree fallback content.</p>
      </slot-card-shadow>

      <p><a href="/" data-testid="back-home">Back to home</a></p>
    </section>
  `;
}
