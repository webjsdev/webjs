import { WebComponent, html } from '@webjsdev/core';

/**
 * `<async-greeting>`: demonstrates bare-await async render (#469). The
 * component fetches its own data INTO the first paint with an async render(),
 * so the SSR HTML already contains the greeting (no fallback, JS-off reads it).
 * The `@click` counter proves the component still hydrates and stays
 * interactive after the async commit. On a client re-fetch the default is
 * stale-while-revalidate (the prior content stays until the new render lands).
 */
export class AsyncGreeting extends WebComponent {
  static properties = { name: { type: String }, n: { type: Number, state: true } };
  declare name: string;
  declare n: number;

  constructor() {
    super();
    this.name = '';
    this.n = 0;
  }

  async render() {
    // Resolves immediately, but the function is async, so the renderer awaits
    // it on both the server (data in first paint) and the client.
    const greeting = await Promise.resolve(`Hello, ${this.name}!`);
    return html`<p class="async-greeting">
      <span class="greeting-text">${greeting}</span>
      <button class="greeting-bump" @click=${() => { this.n = this.n + 1; }}>n=${this.n}</button>
    </p>`;
  }
}
AsyncGreeting.register('async-greeting');
