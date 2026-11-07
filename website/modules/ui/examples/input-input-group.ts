import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupInputClass, inputGroupTextClass,
} from '#modules/ui/components/input-group.ts';
import { InfoIcon } from '#lib/ui/lucide.ts';

export default function InputInputGroup() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
      <label data-slot="field-label" for="input-group-url" class=${fieldLabelClass()}>Website URL</label>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-url" placeholder="example.com" class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-url" class=${inputGroupAddonClass()}>
          <span class=${inputGroupTextClass()}>https://</span>
        </label>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-url" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          ${InfoIcon()}
        </label>
      </div>
    </div>
  `;
}
