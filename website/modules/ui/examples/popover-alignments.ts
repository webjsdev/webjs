import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { popoverContentClass, type PopoverAlign } from '#modules/ui/components/popover.ts';

const aligned = (align: PopoverAlign, label: string, text: string) => {
  const id = 'popover-align-' + align;
  return html`
    <button type="button" popovertarget=${id} aria-haspopup="dialog" aria-expanded="false" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
      ${label}
    </button>
    <div id=${id} popover role="dialog" aria-label=${text} data-slot="popover-content" data-side="bottom" data-align=${align} class=${cn(popoverContentClass({ align }), 'w-40')}>
      ${text}
    </div>
  `;
};

export default function PopoverAlignments() {
  return html`
    <div class="flex gap-6">
      ${aligned('start', 'Start', 'Aligned to start')}
      ${aligned('center', 'Center', 'Aligned to center')}
      ${aligned('end', 'End', 'Aligned to end')}
    </div>
  `;
}
