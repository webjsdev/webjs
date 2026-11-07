import { html } from '@webjsdev/core';
import { inputClass } from '#modules/ui/components/input.ts';

// input-otp's REGEXP_ONLY_DIGITS_AND_CHARS, as the input's own pattern attribute.
const REGEXP_ONLY_DIGITS_AND_CHARS = '[a-zA-Z0-9]*';

export default function InputOTPAlphanumeric() {
  return html`
    <ui-input-otp>
      <input id="input-otp-alphanumeric" aria-label="One-time code" class=${inputClass()} maxlength="6" pattern=${REGEXP_ONLY_DIGITS_AND_CHARS} autocomplete="one-time-code">
      <ui-input-otp-group>
        <ui-input-otp-slot index="0"></ui-input-otp-slot>
        <ui-input-otp-slot index="1"></ui-input-otp-slot>
        <ui-input-otp-slot index="2"></ui-input-otp-slot>
      </ui-input-otp-group>
      <ui-input-otp-separator></ui-input-otp-separator>
      <ui-input-otp-group>
        <ui-input-otp-slot index="3"></ui-input-otp-slot>
        <ui-input-otp-slot index="4"></ui-input-otp-slot>
        <ui-input-otp-slot index="5"></ui-input-otp-slot>
      </ui-input-otp-group>
    </ui-input-otp>
  `;
}
