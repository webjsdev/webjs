// The soft-navigation target. It carries the same view-transition opt-in so the
// cross-fade wraps the swap in BOTH directions, and the same
// data-webjs-permanent input (same id) so the router regrafts the one live node
// across the swap: the text you typed on page one is still here.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';

export const metadata: Metadata = {
  title: 'View transitions: page two | features',
  other: { 'view-transition': 'same-origin' },
};

export default function ViewTransitionsSecond() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Page two</h1>
    <div class="rounded-2xl bg-foreground/5 border border-border p-6 mb-6">
      <p class="text-foreground m-0">You arrived with a cross-fade, no full
        reload. The input below is the same node from page one, regrafted across
        the swap.</p>
    </div>
    <label class="block mb-6">
      <span class="text-muted-foreground text-sm">Its value persisted across the transition:</span>
      <input id="vt-note" data-webjs-permanent type="text" placeholder="type something…"
        class="mt-2 block w-full max-w-sm rounded-xl border border-border bg-card px-4 py-2 text-foreground" />
    </label>
    <a href="/features/view-transitions" class="text-primary no-underline font-medium">&larr; Back to page one</a>
  `;
}
