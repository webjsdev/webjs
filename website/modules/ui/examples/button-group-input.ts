import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { SearchIcon } from '#lib/ui/lucide.ts';

export default function ButtonGroupInput() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <input data-slot="input" type="text" placeholder="Search..." aria-label="Search" class=${inputClass()}>
      <button type="button" data-slot="button" data-variant="outline" data-size="default" aria-label="Search" class=${buttonClass({ variant: 'outline' })}>
        ${SearchIcon()}
      </button>
    </div>
  `;
}
