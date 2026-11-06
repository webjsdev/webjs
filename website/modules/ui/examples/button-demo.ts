import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { ArrowUpIcon } from '#lib/ui/lucide.ts';

export default function ButtonDemo() {
  return html`
    <div class="flex flex-wrap items-center gap-2 md:flex-row">
      <button type="button" data-slot="button" class=${buttonClass({ variant: 'outline' })}>Button</button>
      <button type="button" data-slot="button" aria-label="Submit" class=${buttonClass({ variant: 'outline', size: 'icon' })}>${ArrowUpIcon()}</button>
    </div>
  `;
}
