import { html } from '@webjsdev/core';

/**
 * 404 boundary for the bare /ui frames (/ui/view, /ui/preview), which sit
 * outside app/ui/(chrome)/ and so had fallen through to the root
 * app/not-found.ts. That one is written in the marketing site's classes, and
 * a /ui path loads only public/ui.css, so it rendered unstyled here. This
 * renders inside app/ui/layout.ts, in /ui's own tokens, with no chrome, like
 * the frames themselves. A chrome page keeps app/ui/(chrome)/not-found.ts,
 * the nearer boundary.
 *
 * Keep this file's import graph minimal: if it fails to load, the framework
 * falls through to its generic 404 page. Only @webjsdev/core.
 */
export default function UiFrameNotFound() {
  return html`
    <main id="main" tabindex="-1" class="flex min-h-svh flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p class="m-0 font-mono text-sm text-muted-foreground">404</p>
      <h1 class="m-0 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p class="m-0 max-w-md text-muted-foreground">The page you were looking for does not exist.</p>
      <a class="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline hover:bg-primary/90" href="/ui">Back to WebJs UI</a>
    </main>
  `;
}
