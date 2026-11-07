import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { PlusIcon } from '#lib/ui/lucide.ts';

export default function ButtonGroupSize() {
  return html`
    <div class="flex flex-col items-start gap-8">
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Small</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Button</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Group</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon-sm" aria-label="Add" class=${buttonClass({ variant: 'outline', size: 'icon-sm' })}>
          ${PlusIcon()}
        </button>
      </div>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Default</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Button</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Group</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Add" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
          ${PlusIcon()}
        </button>
      </div>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="lg" class=${buttonClass({ variant: 'outline', size: 'lg' })}>Large</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="lg" class=${buttonClass({ variant: 'outline', size: 'lg' })}>Button</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="lg" class=${buttonClass({ variant: 'outline', size: 'lg' })}>Group</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon-lg" aria-label="Add" class=${buttonClass({ variant: 'outline', size: 'icon-lg' })}>
          ${PlusIcon()}
        </button>
      </div>
    </div>
  `;
}
