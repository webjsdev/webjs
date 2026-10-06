import { WebComponent, html } from '@webjsdev/core';

// One interactive component on every page, so `@webjsdev/core` loads and the
// client router auto-enables (#620), plus a button that makes every kind of
// trouble the embed bridge reports: a console error, a failing fetch, and an
// uncaught throw.
class Trouble extends WebComponent({}) {
  render() {
    return html`<button id="trouble" @click=${() => {
      console.error('trouble: console error');
      fetch('/api/fail');
      setTimeout(() => { throw new Error('trouble: uncaught'); });
    }}>make trouble</button>`;
  }
}
Trouble.register('trouble-el');
