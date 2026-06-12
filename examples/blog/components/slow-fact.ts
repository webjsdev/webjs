import { WebComponent, html } from '@webjsdev/core';

/**
 * `<slow-fact>`: an async-render component whose data is deliberately SLOW
 * (a 400ms await). Unwrapped it would block the first byte; wrapped in
 * `<webjs-suspense>` (#471) on the stream-demo page it STREAMS instead, so the
 * boundary's fallback flushes immediately and this content streams in after the
 * delay (progressively on soft navigation too, #473).
 */
export class SlowFact extends WebComponent {
  async render() {
    await new Promise((r) => setTimeout(r, 400));
    return html`<p class="slow-fact">The answer is 42.</p>`;
  }
}
SlowFact.register('slow-fact');
