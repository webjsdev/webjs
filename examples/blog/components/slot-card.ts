import { WebComponent, html } from '@webjsdev/core';

/**
 * `<slot-card>` is a light-DOM WebComponent demonstrating slot projection.
 *
 * Used by the /slot-demo page and the e2e test suite. Has three slot
 * positions:
 *
 *   name="header"   for the title row,
 *   default         for body content,
 *   name="footer"   for actions, falls back to "no actions" text when
 *                   nothing is projected.
 *
 * The component is plain WebComponent + render() with native <slot>
 * elements. SSR projects authored children directly into slot positions;
 * client hydration preserves DOM identity through the adoption + re-
 * projection sequence.
 */
export class SlotCard extends WebComponent {
  render() {
    return html`
      <article class="rounded-lg border border-border bg-bg-elev p-6">
        <header class="mb-4 border-b border-border pb-3 text-lg font-semibold" data-region="header">
          <slot name="header"></slot>
        </header>
        <div class="text-sm text-fg" data-region="body">
          <slot></slot>
        </div>
        <footer class="mt-4 border-t border-border pt-3 text-xs text-fg-muted" data-region="footer">
          <slot name="footer">no actions</slot>
        </footer>
      </article>
    `;
  }
}
SlotCard.register('slot-card');
