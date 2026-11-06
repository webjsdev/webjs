import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function ButtonSecondary() {
  return html`
    <button type="button" data-slot="button" class=${buttonClass({ variant: 'secondary' })}>Secondary</button>
  `;
}
