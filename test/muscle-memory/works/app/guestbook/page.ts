// Next idiom: a form bound to a server action, showing the action's
// `{ errors }` result after a failed submission and a thank-you after the
// redirect. WebJs hands the failed result to the page as `actionData`.
import { html } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { sign } from '../../modules/guestbook/sign.server.ts';
import type { SignState } from '../../modules/guestbook/sign.server.ts';

export default async function Guestbook({ searchParams, actionData }: PageProps & { actionData?: SignState }) {
  const { thanks } = await searchParams;
  if (thanks) return html`<p>Thanks for signing</p>`;
  return html`
    <form action=${sign}>
      <input name="name">
      ${actionData?.errors?.name ? html`<p class="error">${actionData.errors.name}</p>` : ''}
      <button>Sign</button>
    </form>
  `;
}
