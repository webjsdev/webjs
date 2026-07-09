// error.ts is the error boundary for this segment's subtree. A render-time
// exception in a sibling or deeper page (see crash/page.ts) is caught here and
// rendered scoped to this boundary, so outer layouts stay alive. The default
// export receives { error, ...ctx }; in production only error.message is sent.
import { html } from '@webjsdev/core';

export default function BoundariesError({ error }: { error: Error }) {
  return html`
    <h1 class="text-h2 font-bold mb-4">Something went wrong</h1>
    <p class="text-muted-foreground mb-4">
      This segment's <code class="font-mono">error.ts</code> boundary caught a
      render error: <code class="font-mono">${error?.message ?? 'unknown'}</code>.
    </p>
    <p><a class="text-primary" href="/features/boundaries">Back to boundaries</a></p>
  `;
}
