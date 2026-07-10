import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Deferred frame content · WebJs Blog',
};

/**
 * `/frame-demo/deferred` is the content source for the lazy self-loading
 * `<webjs-frame id="deferred" src loading="lazy">` on `/frame-demo` (#253).
 *
 * It renders a `<webjs-frame id="deferred">` so that when the parent frame
 * self-fetches this URL (sending `x-webjs-frame: deferred`), the server returns
 * ONLY this frame subtree (the isolable region render), which the client swaps
 * into the parent frame through the standard frame-swap path. The marked-up
 * content carries an id the e2e probe asserts appeared after the self-load.
 *
 * Navigating to this URL directly serves the full page (the frame plus the
 * document shell), which is also fine: the frame is the page's content here.
 */
export default function DeferredFrame() {
  return html`
    <webjs-frame id="deferred" class="block">
      <p id="deferred-loaded" class="text-sm">Deferred content loaded from the server.</p>
    </webjs-frame>
  `;
}
