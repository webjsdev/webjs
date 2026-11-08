import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { getThing } from '#actions/things.server.ts';

/**
 * A SHIPPING async component: the `@click` is an interactivity signal, so
 * elision keeps it and its module really does re-run `async render()` on
 * hydration. That re-run is exactly what the seed is there to answer without a
 * network round-trip, so an elided component would prove nothing here.
 */
class ThingCard extends WebComponent({ tid: prop(Number) }) {
  #bump = signal(0);

  constructor() {
    super();
    this.tid = 1;
  }

  async render() {
    // Read before the await: only reads ahead of it are tracked.
    const bump = this.#bump.get();
    const t = await getThing(this.tid);
    return html`
      <p class="lbl">${t.label}</p>
      <button id="bump" @click=${() => this.#bump.set(bump + 1)}>bumped ${bump}</button>
    `;
  }
}
ThingCard.register('thing-card');
