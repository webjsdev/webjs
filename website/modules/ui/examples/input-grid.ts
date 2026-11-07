import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputGrid() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'grid max-w-sm grid-cols-2')}>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="first-name" class=${fieldLabelClass()}>First Name</label>
        <input data-slot="input" id="first-name" placeholder="Jordan" class=${inputClass()}>
      </div>
      <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
        <label data-slot="field-label" for="last-name" class=${fieldLabelClass()}>Last Name</label>
        <input data-slot="input" id="last-name" placeholder="Lee" class=${inputClass()}>
      </div>
    </div>
  `;
}
