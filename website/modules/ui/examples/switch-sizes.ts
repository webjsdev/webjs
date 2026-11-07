import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';

export default function SwitchSizes() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'w-full max-w-[10rem]')}>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <ui-switch input-id="switch-size-sm" size="sm"></ui-switch>
        <label data-slot="field-label" for="switch-size-sm" class=${fieldLabelClass()}>Small</label>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <ui-switch input-id="switch-size-default" size="default"></ui-switch>
        <label data-slot="field-label" for="switch-size-default" class=${fieldLabelClass()}>Default</label>
      </div>
    </div>
  `;
}
