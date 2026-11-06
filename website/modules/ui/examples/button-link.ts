import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function ButtonLink() {
  return html`
    <button type="button" data-slot="button" class=${buttonClass({ variant: 'link' })}>Link</button>
  `;
}
