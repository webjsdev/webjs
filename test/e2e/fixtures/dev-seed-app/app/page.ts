import { html } from '@webjsdev/core';
import '#components/thing-card.ts';

export default function Page() {
  return html`
    <h1>seeded</h1>
    <thing-card tid="1"></thing-card>
    <a id="to-server-only" href="/server-only">server-only</a>
    <a id="to-unseeded" href="/unseeded">unseeded</a>
  `;
}
