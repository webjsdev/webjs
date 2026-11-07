import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function ButtonDestructive() {
  return html`
    <button type="button" data-slot="button" class=${buttonClass({ variant: 'destructive' })}>Destructive</button>
  `;
}
