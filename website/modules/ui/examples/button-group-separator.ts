import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass, buttonGroupSeparatorClass } from '#modules/ui/components/button-group.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';

export default function ButtonGroupSeparatorDemo() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <button type="button" data-slot="button" data-variant="secondary" data-size="sm" class=${buttonClass({ variant: 'secondary', size: 'sm' })}>Copy</button>
      <div role="none" data-slot="button-group-separator" data-orientation="vertical" class=${cn(separatorClass({ orientation: 'vertical' }), buttonGroupSeparatorClass())}></div>
      <button type="button" data-slot="button" data-variant="secondary" data-size="sm" class=${buttonClass({ variant: 'secondary', size: 'sm' })}>Paste</button>
    </div>
  `;
}
