import { WebComponent, html, signal } from '@webjsdev/core';
import { getSlow } from '#modules/verbdemo/queries/get-slow.server.ts';

/**
 * `<abort-demo>`: the AbortSignal demo (#492). Its async render() awaits a slow
 * GET action; bumping `n` supersedes the in-flight render, and the framework
 * aborts the previous render's fetch (the e2e probes for net::ERR_ABORTED).
 */
export class AbortDemo extends WebComponent {
  private n = signal(0);

  async render() {
    const r = await getSlow(this.n.get());
    return html`<div class="abort-demo">
      <span class="ad-n">n=${r.n}</span>
      <button class="ad-bump" @click=${() => this.n.set(this.n.get() + 1)}>bump</button>
    </div>`;
  }
}
AbortDemo.register('abort-demo');
