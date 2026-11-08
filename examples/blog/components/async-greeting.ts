import { WebComponent, html, signal } from '@webjsdev/core';

/**
 * `<async-greeting>`: demonstrates bare-await async render (#469). The
 * component fetches its own data INTO the first paint with an async render(),
 * so the SSR HTML already contains the greeting (no fallback, JS-off reads it).
 * The `@click` counter proves the component still hydrates and stays
 * interactive after the async commit. On a client re-fetch the default is
 * stale-while-revalidate (the prior content stays until the new render lands).
 */
export class AsyncGreeting extends WebComponent({ name: String }) {
  #n = signal(0);

  constructor() {
    super();
    this.name = '';
  }

  async render() {
    // Read the signal before the await: only reads ahead of it are tracked.
    const n = this.#n.get();
    // Resolves immediately, but the function is async, so the renderer awaits
    // it on both the server (data in first paint) and the client.
    const greeting = await Promise.resolve(`Hello, ${this.name}!`);
    return html`<p class="async-greeting">
      <span class="greeting-text">${greeting}</span>
      <button class="greeting-bump" @click=${() => this.#n.set(n + 1)}>n=${n}</button>
    </p>`;
  }
}
AsyncGreeting.register('async-greeting');
