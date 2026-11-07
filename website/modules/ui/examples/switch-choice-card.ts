import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldGroupClass, fieldClass, fieldContentClass, fieldLabelClass,
  fieldTitleClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';

// The whole card is the <label>, so a click anywhere on it flips the switch.
export default function SwitchChoiceCard() {
  return html`
    <div data-slot="field-group" class=${cn(fieldGroupClass(), 'w-full max-w-sm')}>
      <label data-slot="field-label" for="switch-share" class=${fieldLabelClass()}>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <div data-slot="field-label" class=${fieldTitleClass()}>Share across devices</div>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>
              Focus is shared across devices, and turns off when you leave the
              app.
            </p>
          </div>
          <ui-switch input-id="switch-share"></ui-switch>
        </div>
      </label>
      <label data-slot="field-label" for="switch-notifications" class=${fieldLabelClass()}>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <div data-slot="field-label" class=${fieldTitleClass()}>Enable notifications</div>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>
              Receive notifications when focus mode is enabled or disabled.
            </p>
          </div>
          <ui-switch input-id="switch-notifications" checked></ui-switch>
        </div>
      </label>
    </div>
  `;
}
