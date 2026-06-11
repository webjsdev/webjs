import { WebComponent, html } from '@webjsdev/core';

/**
 * `<inline-quote>`: a BARE async-render display-only leaf (#474). It fetches
 * its own data with an `async render()` and has NO other client signal (no
 * `@event`, no non-state reactive prop, no signal, no lifecycle hook, no
 * `<slot>`, light DOM). SSR bakes the resolved quote into the first paint, so
 * the HTML is identical with or without JS and the module is ELIDED from the
 * browser (no download, no redundant on-hydration re-fetch). It is the
 * counterpart to `<async-greeting>` (which ships because of its `@click`) and
 * `<slow-fact>` (bare async too, but wrapped in `<webjs-suspense>` to stream).
 */
export class InlineQuote extends WebComponent {
  async render() {
    // Resolves immediately; the async keyword still routes both SSR and the
    // (now-elided) client through the await. Blocking, so the data is in the
    // first paint with no fallback, which is what makes it JS-off-readable.
    const quote = await Promise.resolve('What you read is what runs.');
    return html`<blockquote class="inline-quote">${quote}</blockquote>`;
  }
}
InlineQuote.register('inline-quote');
