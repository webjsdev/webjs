import { html, type PageProps } from '@webjsdev/core';

export const metadata = {
  title: 'Frame demo · webjs blog',
  description: 'A <webjs-frame> driven by external links (data-webjs-frame) and a _top breakout.',
};

/**
 * `/frame-demo` is the e2e fixture for `<webjs-frame>` external targeting +
 * the aria-busy lifecycle (#252).
 *
 * The page renders a `<webjs-frame id="panel">` whose content is chosen by
 * the `?tab=` query param. The tab links sit OUTSIDE the frame and carry
 * `data-webjs-frame="panel"`, so the client router drives the frame by id
 * even though the links are not DOM-nested in it. Because the page always
 * renders the frame, the navigation response always contains the matching
 * `<webjs-frame id="panel">`, so the swap is scoped to the frame's children
 * and the surrounding page (heading, the tab links, the outside sentinel) is
 * left untouched.
 *
 * The `_top` link lives INSIDE the frame and carries
 * `data-webjs-frame="_top"`, so clicking it breaks OUT of the frame to a
 * full-page navigation (here, back to the blog home).
 *
 * No interactivity (no events, signals, or custom elements) lives in the
 * page itself; the frame swap is a pure client-router behaviour.
 */
export default function FrameDemo({ searchParams }: PageProps) {
  const tab = String(searchParams.tab || 'one');
  const bodies: Record<string, string> = {
    one: 'Panel content ONE.',
    two: 'Panel content TWO.',
    three: 'Panel content THREE.',
  };
  const body = bodies[tab] || bodies.one;

  return html`
    <section class="grid gap-6 max-w-2xl">
      <h1 id="frame-demo-heading" class="text-2xl font-semibold tracking-tight">Frame demo</h1>

      <!-- A sentinel OUTSIDE the frame. A correct frame swap leaves it
           untouched; a wrong full-body swap would destroy it. -->
      <p id="outside-sentinel" class="text-fg-muted text-sm">Outside the frame.</p>

      <!-- External tab links. NOT nested in the frame; they target it by id. -->
      <nav class="flex gap-3 text-sm" data-frame-tabs>
        <a id="tab-one" href="/frame-demo?tab=one" data-webjs-frame="panel" class="underline">One</a>
        <a id="tab-two" href="/frame-demo?tab=two" data-webjs-frame="panel" class="underline">Two</a>
        <a id="tab-three" href="/frame-demo?tab=three" data-webjs-frame="panel" class="underline">Three</a>
      </nav>

      <webjs-frame id="panel" class="block rounded-md border border-border bg-bg-elev p-4">
        <p id="panel-body" data-tab=${tab}>${body}</p>
        <!-- A _top breakout link INSIDE the frame: a full-page nav home. -->
        <a id="top-link" href="/" data-webjs-frame="_top" class="text-fg-subtle text-xs underline">Exit to home (full nav)</a>
      </webjs-frame>
    </section>
  `;
}
