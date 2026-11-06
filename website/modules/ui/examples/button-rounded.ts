import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { cn } from '#lib/utils/cn.ts';
import { ArrowUpIcon } from '#lib/ui/lucide.ts';

export default function ButtonRounded() {
  return html`
    <div class="flex flex-col gap-8">
      <button type="button" data-slot="button" aria-label="Scroll up" class=${cn(buttonClass({ variant: 'outline', size: 'icon' }), 'rounded-full')}>${ArrowUpIcon()}</button>
    </div>
  `;
}
