import { WebComponent, html } from '@webjsdev/core';
import { goAway } from '#modules/go-away.server.ts';

/** Calls an action that throws redirect(); nothing else navigates. */
class GoButton extends WebComponent({}) {
  render() {
    return html`<button id="go" @click=${() => goAway()}>Go</button>`;
  }
}
GoButton.register('go-button');
