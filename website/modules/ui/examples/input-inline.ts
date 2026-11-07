import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { fieldClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputInline() {
  return html`
    <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
      <input data-slot="input" type="search" placeholder="Search..." aria-label="Search" class=${inputClass()}>
      <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>Search</button>
    </div>
  `;
}
