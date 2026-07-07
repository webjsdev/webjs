// webjs-scaffold-placeholder. Example gallery route. Keep and adapt it, or prune it (delete this app/examples/tic-tac-toe route AND modules/tic-tac-toe), then delete this marker line. webjs check fails while the marker remains.
// A thin route rendering a client-only component. The page runs server-side to
// produce the SSR'd first paint (the empty board), then <tic-tac-toe> hydrates
// and all interactivity runs client-side. Pages do not hydrate; components do.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/tic-tac-toe/components/tic-tac-toe.ts';

export const metadata: Metadata = { title: 'Tic-tac-toe (client signals) | examples' };

export default function TicTacToeExample() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Tic-tac-toe</h1>
    <p class="text-fg-muted mb-4">Client-only interactivity with signals, no server or database.</p>
    <tic-tac-toe></tic-tac-toe>
  `;
}
