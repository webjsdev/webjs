import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldClass, fieldContentClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';

export default function SwitchDescription() {
  return html`
    <div role="group" data-slot="field" data-orientation="horizontal" class=${cn(fieldClass({ orientation: 'horizontal' }), 'max-w-sm')}>
      <div data-slot="field-content" class=${fieldContentClass()}>
        <label data-slot="field-label" for="switch-focus-mode" class=${fieldLabelClass()}>
          Share across devices
        </label>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>
          Focus is shared across devices, and turns off when you leave the app.
        </p>
      </div>
      <ui-switch input-id="switch-focus-mode"></ui-switch>
    </div>
  `;
}
