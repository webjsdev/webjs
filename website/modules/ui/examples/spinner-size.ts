import { html } from '@webjsdev/core';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function SpinnerSize() {
  return html`
    <div class="flex items-center gap-6">
      ${spinner({ class: 'size-3' })}
      ${spinner({ class: 'size-4' })}
      ${spinner({ class: 'size-6' })}
      ${spinner({ class: 'size-8' })}
    </div>
  `;
}
