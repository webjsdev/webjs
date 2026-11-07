import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';

export default function FieldSwitch() {
  return html`
    <div role="group" data-slot="field" data-orientation="horizontal" class=${cn(fieldClass({ orientation: 'horizontal' }), 'w-fit')}>
      <label data-slot="field-label" for="2fa" class=${fieldLabelClass()}>Multi-factor authentication</label>
      <ui-switch input-id="2fa"></ui-switch>
    </div>
  `;
}
