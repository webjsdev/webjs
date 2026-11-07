import { html } from '@webjsdev/core';
import { inputClass } from '#modules/ui/components/input.ts';

export default function InputOTPWithSeparator() {
  return html`
    <ui-input-otp>
      <input id="input-otp-separator" aria-label="One-time code" class=${inputClass()} maxlength="6" inputmode="numeric" autocomplete="one-time-code">
      <ui-input-otp-group>
        <ui-input-otp-slot index="0"></ui-input-otp-slot>
        <ui-input-otp-slot index="1"></ui-input-otp-slot>
      </ui-input-otp-group>
      <ui-input-otp-separator></ui-input-otp-separator>
      <ui-input-otp-group>
        <ui-input-otp-slot index="2"></ui-input-otp-slot>
        <ui-input-otp-slot index="3"></ui-input-otp-slot>
      </ui-input-otp-group>
      <ui-input-otp-separator></ui-input-otp-separator>
      <ui-input-otp-group>
        <ui-input-otp-slot index="4"></ui-input-otp-slot>
        <ui-input-otp-slot index="5"></ui-input-otp-slot>
      </ui-input-otp-group>
    </ui-input-otp>
  `;
}
