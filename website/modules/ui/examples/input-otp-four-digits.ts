import { html } from '@webjsdev/core';
import { inputClass } from '#modules/ui/components/input.ts';

// input-otp's REGEXP_ONLY_DIGITS, as the input's own pattern attribute.
const REGEXP_ONLY_DIGITS = '[0-9]*';

export default function InputOTPFourDigits() {
  return html`
    <ui-input-otp>
      <input id="input-otp-four-digits" aria-label="PIN" class=${inputClass()} maxlength="4" pattern=${REGEXP_ONLY_DIGITS} inputmode="numeric" autocomplete="one-time-code">
      <ui-input-otp-group>
        <ui-input-otp-slot index="0"></ui-input-otp-slot>
        <ui-input-otp-slot index="1"></ui-input-otp-slot>
        <ui-input-otp-slot index="2"></ui-input-otp-slot>
        <ui-input-otp-slot index="3"></ui-input-otp-slot>
      </ui-input-otp-group>
    </ui-input-otp>
  `;
}
