import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { MinusIcon, PlusIcon } from '#lib/ui/lucide.ts';

export default function ButtonGroupOrientation() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="vertical" aria-label="Media controls" class=${cn(buttonGroupClass({ orientation: 'vertical' }), 'h-fit')}>
      <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Increase" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
        ${PlusIcon()}
      </button>
      <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Decrease" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
        ${MinusIcon()}
      </button>
    </div>
  `;
}
