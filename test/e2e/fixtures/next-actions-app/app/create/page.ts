import { html } from '@webjsdev/core';
import { createItem } from '#modules/create-item.server.ts';

export default function Create() {
  return html`<form action=${createItem}><button id="create" type="submit">Create</button></form>`;
}
