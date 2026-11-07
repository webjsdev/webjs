import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass, buttonGroupSeparatorClass } from '#modules/ui/components/button-group.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';
import { IconPlus } from '#lib/ui/tabler.ts';

export default function ButtonGroupSplit() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <button type="button" data-slot="button" data-variant="secondary" data-size="default" class=${buttonClass({ variant: 'secondary' })}>Button</button>
      <div role="none" data-slot="button-group-separator" data-orientation="vertical" class=${cn(separatorClass({ orientation: 'vertical' }), buttonGroupSeparatorClass())}></div>
      <button type="button" data-slot="button" data-variant="secondary" data-size="icon" aria-label="Add" class=${buttonClass({ variant: 'secondary', size: 'icon' })}>
        ${IconPlus()}
      </button>
    </div>
  `;
}
