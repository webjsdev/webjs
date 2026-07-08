// The nearest 403 boundary for a thrown forbidden(). A forbidden.ts default-
// exports a function returning a TemplateResult, rendered at status 403 in place
// of the page that threw. Nearest wins: this one (inside gated/) beats any
// forbidden.ts higher up the tree. Keep the message actionable for an
// authenticated user who lacks permission.
import { html } from '@webjsdev/core';

export default function Forbidden() {
  return html`
    <h1 class="text-h2 font-bold mb-4">403 Forbidden</h1>
    <p class="text-muted-foreground mb-4">
      You are signed in but do not have permission to view this page. This is the
      nearest <code class="font-mono">forbidden.ts</code> boundary, rendered
      because the page threw <code class="font-mono">forbidden()</code>.
    </p>
    <p><a class="text-primary" href="/features/boundaries">Back to boundaries</a></p>
  `;
}
