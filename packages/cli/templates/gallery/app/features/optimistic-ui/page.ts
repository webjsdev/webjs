// webjs-scaffold-placeholder. Feature gallery route. Keep and adapt it, or prune it (delete this app/features/optimistic-ui route AND modules/optimistic-ui), then delete this marker line. webjs check fails while the marker remains.
import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/optimistic-ui/components/like-button.ts';

export const metadata: Metadata = { title: 'Optimistic UI (imperative flip) | features' };

export default function OptimisticUiFeature() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Optimistic UI</h1>
    <p class="text-fg-muted mb-4">The imperative <code>optimistic(signal, value, action)</code> form: the UI flips instantly and rolls back if the action fails. For the declarative list form (add / remove with rollback) in a full app, see <a class="text-accent" href="/examples/todo">/examples/todo</a>.</p>
    <like-button></like-button>
  `;
}
