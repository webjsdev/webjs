import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function ButtonSpinner() {
  return html`
    <div class="flex gap-2">
      <button type="button" data-slot="button" disabled aria-busy="true" class=${buttonClass({ variant: 'outline' })}>
        ${spinner({ decorative: true })}
        Generating
      </button>
      <button type="button" data-slot="button" disabled aria-busy="true" class=${buttonClass({ variant: 'secondary' })}>
        Downloading
        ${spinner({ decorative: true })}
      </button>
    </div>
  `;
}
