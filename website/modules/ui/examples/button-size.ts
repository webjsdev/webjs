import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { ArrowUpRightIcon } from '#lib/ui/lucide.ts';

export default function ButtonSize() {
  return html`
    <div class="flex flex-col items-start gap-8 sm:flex-row">
      <div class="flex items-start gap-2">
        <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline', size: 'xs' })}>Extra Small</button>
        <button type="button" data-slot="button" aria-label="Submit" class=${buttonClass({ variant: 'outline', size: 'icon-xs' })}>${ArrowUpRightIcon()}</button>
      </div>
      <div class="flex items-start gap-2">
        <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Small</button>
        <button type="button" data-slot="button" aria-label="Submit" class=${buttonClass({ variant: 'outline', size: 'icon-sm' })}>${ArrowUpRightIcon()}</button>
      </div>
      <div class="flex items-start gap-2">
        <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline' })}>Default</button>
        <button type="button" data-slot="button" aria-label="Submit" class=${buttonClass({ variant: 'outline', size: 'icon' })}>${ArrowUpRightIcon()}</button>
      </div>
      <div class="flex items-start gap-2">
        <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline', size: 'lg' })}>Large</button>
        <button type="button" data-slot="button" aria-label="Submit" class=${buttonClass({ variant: 'outline', size: 'icon-lg' })}>${ArrowUpRightIcon()}</button>
      </div>
    </div>
  `;
}
