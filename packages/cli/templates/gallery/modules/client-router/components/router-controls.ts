// Programmatic client navigation. `navigate(url)` does the same soft, in-place
// swap an <a> click does, but from an event handler (after a save, a wizard
// step, etc.). `revalidate(url?)` evicts the browser snapshot cache so the next
// visit refetches fresh HTML instead of the cached page. Both are client-only
// (they run in the browser), so a component is the right home; a page/layout
// never hydrates. With JS off this component is inert, so keep real navigation
// on plain <a href> and use navigate() only for JS-driven flows.
import { WebComponent, html, navigate, revalidate } from '@webjsdev/core';

export class RouterControls extends WebComponent {
  render() {
    return html`
      <div class="flex gap-3 items-center">
        <button
          @click=${() => navigate('/features/client-router/second')}
          class="inline-flex items-center px-4 py-2 rounded-xl bg-card border border-border text-foreground font-medium text-sm cursor-pointer transition-colors hover:border-border-strong">navigate() to page two</button>
        <button
          @click=${() => revalidate()}
          class="text-muted-foreground font-medium text-sm cursor-pointer transition-colors hover:text-foreground underline decoration-dotted underline-offset-4">revalidate() the snapshot cache</button>
      </div>
    `;
  }
}
RouterControls.register('router-controls');
