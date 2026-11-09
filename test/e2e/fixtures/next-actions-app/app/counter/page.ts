import { html } from '@webjsdev/core';
import { readCount } from '#modules/read-count.server.ts';
import '#components/bump-button.ts';

export default async function Counter() {
  const n = await readCount();
  return html`<p id="count">${n}</p><bump-button></bump-button>`;
}
