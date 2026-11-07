import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { SearchIcon } from '#lib/ui/lucide.ts';

export default function InputGroupInlineStart() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'max-w-sm')}>
      <label data-slot="field-label" for="inline-start-input" class=${fieldLabelClass()}>Input</label>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="inline-start-input" placeholder="Search..." class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="inline-start-input" class=${inputGroupAddonClass({ align: 'inline-start' })}>
          ${SearchIcon('text-muted-foreground')}
        </label>
      </div>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>Icon positioned at the start.</p>
    </div>
  `;
}
