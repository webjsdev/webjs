import { html } from '@webjsdev/core';

/**
 * Error boundary for the bare /ui frames (/ui/view, /ui/preview) and for a
 * crash in app/ui/(chrome)/layout.ts itself, the counterpart of
 * app/ui/not-found.ts: either used to render the root app/error.ts, in the
 * marketing site's classes, which a /ui path no longer loads. A chrome page
 * keeps app/ui/(chrome)/error.ts, the nearer boundary. Receives the thrown
 * value as ctx.error.
 *
 * Keep this file's import graph minimal: it MUST stay importable when the
 * rest of the app is broken. Only @webjsdev/core.
 *
 * (No U+0060 GRAVE ACCENT characters in the html template body below: one
 * would close the tagged template at parse time.)
 */
export default function UiFrameError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return html`
    <main id="main" tabindex="-1" class="flex min-h-svh flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p class="m-0 font-mono text-sm text-muted-foreground">500</p>
      <h1 class="m-0 text-2xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
      <p class="m-0 max-w-md text-muted-foreground">We hit an unexpected error while rendering this page. The full stack is logged on the server.</p>
      <pre tabindex="0" class="m-0 max-w-full overflow-x-auto rounded-lg bg-muted px-4 py-3 text-left font-mono text-sm"><code>${message}</code></pre>
      <a class="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline hover:bg-primary/90" href="/ui">Back to WebJs UI</a>
    </main>
  `;
}
