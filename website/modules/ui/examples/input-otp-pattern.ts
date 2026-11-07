import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

// input-otp's REGEXP_ONLY_DIGITS, as the input's own pattern attribute.
const REGEXP_ONLY_DIGITS = '[0-9]*';

export default function InputOTPPattern() {
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" class=${cn(fieldClass(), 'w-fit')}>
      <label data-slot="field-label" for="digits-only" class=${fieldLabelClass()}>Digits Only</label>
      <ui-input-otp>
        <input id="digits-only" class=${inputClass()} maxlength="6" pattern=${REGEXP_ONLY_DIGITS} inputmode="numeric" autocomplete="one-time-code">
        <ui-input-otp-group>
          <ui-input-otp-slot index="0"></ui-input-otp-slot>
          <ui-input-otp-slot index="1"></ui-input-otp-slot>
          <ui-input-otp-slot index="2"></ui-input-otp-slot>
          <ui-input-otp-slot index="3"></ui-input-otp-slot>
          <ui-input-otp-slot index="4"></ui-input-otp-slot>
          <ui-input-otp-slot index="5"></ui-input-otp-slot>
        </ui-input-otp-group>
      </ui-input-otp>
    </div>
  `;
}
