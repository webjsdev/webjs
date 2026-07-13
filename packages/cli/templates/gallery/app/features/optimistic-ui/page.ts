import { html } from '@webjsdev/core';
import type { Metadata } from '@webjsdev/core';
import '#modules/optimistic-ui/components/like-button.ts';

export const metadata: Metadata = { title: 'Optimistic UI (imperative flip) | features' };

export default function OptimisticUiFeature() {
  return html`
    <h1 class="text-h2 font-bold mb-4">Optimistic UI</h1>
    <p class="text-muted-foreground mb-4">The imperative <code>optimistic(signal, value, action)</code> form: the UI flips instantly and rolls back if the action fails. For the declarative list form (add / remove with rollback) in a full app, see <a class="text-primary" href="/examples/todo">/examples/todo</a>.</p>
    <like-button></like-button>
  `;
}
