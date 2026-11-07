import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';

export default function SwitchDisabled() {
  return html`
    <div role="group" data-slot="field" data-orientation="horizontal" data-disabled="true" class=${cn(fieldClass({ orientation: 'horizontal' }), 'w-fit')}>
      <ui-switch input-id="switch-disabled-unchecked" disabled></ui-switch>
      <label data-slot="field-label" for="switch-disabled-unchecked" class=${fieldLabelClass()}>Disabled</label>
    </div>
  `;
}
