// not-found.ts is the nearest 404 boundary for this subtree. It renders both
// for a thrown notFound() in a page below here AND for an unmatched URL under
// /features/boundaries/ (try /features/boundaries/does-not-exist). Nearest wins,
// so this beats the root not-found for anything in this segment.
import { html } from '@webjsdev/core';

export default function BoundariesNotFound() {
  return html`
    <h1 class="text-h2 font-bold mb-4">404: Not here</h1>
    <p class="text-muted-foreground mb-4">
      This segment's <code class="font-mono">not-found.ts</code> boundary rendered,
      because a page threw <code class="font-mono">notFound()</code> or the URL
      matched nothing under this segment.
    </p>
    <p><a class="text-primary" href="/features/boundaries">Back to boundaries</a></p>
  `;
}
