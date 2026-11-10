import { html } from '@webjsdev/core';
import '#components/server-card.server.ts';
import '#components/counter.ts';

export default function Page() {
  return html`
    <h1>server-only</h1>
    <server-card></server-card>
    <counter-el></counter-el>
    <a id="to-home" href="/">home</a>
  `;
}
