import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function SpinnerButton() {
  return html`
    <div class="flex flex-col items-center gap-4">
      <button type="button" data-slot="button" data-variant="default" data-size="sm" disabled aria-busy="true" class=${buttonClass({ size: 'sm' })}>
        ${spinner({ decorative: true })}
        Loading...
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" disabled aria-busy="true" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
        ${spinner({ decorative: true })}
        Please wait
      </button>
      <button type="button" data-slot="button" data-variant="secondary" data-size="sm" disabled aria-busy="true" class=${buttonClass({ variant: 'secondary', size: 'sm' })}>
        ${spinner({ decorative: true })}
        Processing
      </button>
    </div>
  `;
}
