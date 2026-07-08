// A dynamic route: `params.id` is the URL segment. The default export is a
// (possibly async) function receiving { params, searchParams, url }; it runs
// ONLY on the server. Throw notFound() / redirect() to short-circuit.
//
// Type-safe routes: instead of hand-typing `{ params: { id: string } }`, type
// the props with PageProps<'<route>'>. `webjs types` (run automatically by
// `webjs dev`) generates .webjs/routes.d.ts with a Route union and per-route
// params, so PageProps<'/features/routing/[id]'>['params'] narrows to
// { id: string } automatically. Rename the folder and the type follows; pass a
// route literal that does not exist and it is a compile error.
import { html } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';

export default function RoutingParam({ params }: PageProps<'/features/routing/[id]'>) {
  return html`
    <h1 class="text-h2 font-bold mb-4">Route param</h1>
    <p>The <code>[id]</code> segment is: <strong>${params.id}</strong></p>
    <p class="text-muted-foreground text-sm mt-3">
      Typed with <code class="font-mono">PageProps&lt;'/features/routing/[id]'&gt;</code>,
      so <code class="font-mono">params.id</code> is a checked
      <code class="font-mono">string</code> from the generated route union.
    </p>
    <p class="mt-3"><a class="text-primary" href="/features/routing">Back</a></p>
  `;
}
