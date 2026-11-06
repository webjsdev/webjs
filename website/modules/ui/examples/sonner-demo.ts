import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function SonnerDemo() {
  return html`
    <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
      Show Toast
    </button>
  `;
}
