// A dynamic route: `params.id` is the URL segment. The default export is a
// (possibly async) function receiving { params, searchParams, url }; it runs
// ONLY on the server. Throw notFound() / redirect() to short-circuit.
import { html } from '@webjsdev/core';

export default function RoutingParam({ params }: { params: { id: string } }) {
  return html`
    <h1 class="text-h2 font-bold mb-4">Route param</h1>
    <p>The <code>[id]</code> segment is: <strong>${params.id}</strong></p>
    <p class="mt-3"><a class="text-accent" href="/examples/routing">Back</a></p>
  `;
}
