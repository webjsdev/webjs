import { WebComponent, html } from '@webjsdev/core';
import { getThing } from '#actions/things.server.ts';

/**
 * A server-only async-render component: it lives in a `.server.ts` file with
 * no `'use server'`, so its module never ships, nothing on the client ever
 * calls the action, and its seed sits in the page unconsumed (#1686).
 *
 * That is the shape that leaves a seed block in the LIVE document, because the
 * initial scan is lazy and fires on the first `takeSeed`, which never happens
 * here. It is what makes the drain on the next navigation matter.
 */
class ServerCard extends WebComponent({}) {
  async render() {
    const t = await getThing(1);
    return html`<p class="lbl">${t.label}</p>`;
  }
}
ServerCard.register('server-card');
