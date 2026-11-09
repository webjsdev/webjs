import { WebComponent, html } from '@webjsdev/core';
import { bump } from '#modules/bump.server.ts';

/** Calls an action that revalidates the page on screen; nothing else re-renders it. */
class BumpButton extends WebComponent({}) {
  render() {
    return html`<button id="bump" @click=${() => bump()}>Bump</button>`;
  }
}
BumpButton.register('bump-button');
