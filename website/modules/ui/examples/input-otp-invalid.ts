import { html } from '@webjsdev/core';
import { inputClass } from '#modules/ui/components/input.ts';

// aria-invalid goes on the real input; the element passes it to every slot.
export default function InputOTPInvalid() {
  return html`
    <ui-input-otp>
      <input id="input-otp-invalid" aria-label="One-time code" aria-invalid="true" value="000000" class=${inputClass()} maxlength="6" inputmode="numeric" autocomplete="one-time-code">
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
