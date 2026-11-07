import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldClass, fieldContentClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';

export default function SwitchInvalid() {
  return html`
    <div role="group" data-slot="field" data-orientation="horizontal" data-invalid="true" class=${cn(fieldClass({ orientation: 'horizontal' }), 'max-w-sm')}>
      <div data-slot="field-content" class=${fieldContentClass()}>
        <label data-slot="field-label" for="switch-terms" class=${fieldLabelClass()}>
          Accept terms and conditions
        </label>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          You must accept the terms and conditions to continue.
        </p>
      </div>
      <ui-switch input-id="switch-terms" aria-invalid="true"></ui-switch>
    </div>
  `;
}
