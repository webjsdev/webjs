import { html } from '@webjsdev/core';

/**
 * 404 boundary for the /ui section. A /ui page that throws notFound() renders
 * this INSIDE app/ui/(chrome)/layout.ts, so the reader keeps the /ui header
 * and footer. An URL that matches no route at all renders the root
 * app/not-found.ts instead, with no layouts around it.
 *
 * Keep this file's import graph minimal: if it fails to load, the framework
 * falls through to its generic 404 page. Only @webjsdev/core.
 */
export default function UiNotFound() {
  return html`
    <div class="container-wrapper flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p class="m-0 font-mono text-sm text-muted-foreground">404</p>
      <h1 class="m-0 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p class="m-0 max-w-md text-muted-foreground">The page you were looking for does not exist.</p>
      <a class="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline hover:bg-primary/90" href="/ui">Back to WebJs UI</a>
    </div>
  `;
}
