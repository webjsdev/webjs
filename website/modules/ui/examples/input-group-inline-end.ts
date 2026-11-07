import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { EyeOffIcon } from '#lib/ui/lucide.ts';

export default function InputGroupInlineEnd() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'max-w-sm')}>
      <label data-slot="field-label" for="inline-end-input" class=${fieldLabelClass()}>Input</label>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="inline-end-input" type="password" placeholder="Enter password" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="inline-end-input" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          ${EyeOffIcon()}
        </label>
      </div>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>Icon positioned at the end.</p>
    </div>
  `;
}
