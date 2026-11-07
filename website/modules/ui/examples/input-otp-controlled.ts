import { html } from '@webjsdev/core';
import { inputClass } from '#modules/ui/components/input.ts';

// shadcn's demo keeps the code in React state to echo it below the slots.
// The element reports every change as a ui-value-change event carrying the
// value, so a listener on it can write the line below. Shown here at rest.
export default function InputOTPControlled() {
  const value = '';

  return html`
    <div class="space-y-2">
      <ui-input-otp>
        <input id="input-otp-controlled" aria-label="One-time password" value=${value} class=${inputClass()} maxlength="6" inputmode="numeric" autocomplete="one-time-code">
        <ui-input-otp-group>
          <ui-input-otp-slot index="0"></ui-input-otp-slot>
          <ui-input-otp-slot index="1"></ui-input-otp-slot>
          <ui-input-otp-slot index="2"></ui-input-otp-slot>
          <ui-input-otp-slot index="3"></ui-input-otp-slot>
          <ui-input-otp-slot index="4"></ui-input-otp-slot>
          <ui-input-otp-slot index="5"></ui-input-otp-slot>
        </ui-input-otp-group>
      </ui-input-otp>
      <div class="text-center text-sm">
        ${value === '' ? 'Enter your one-time password.' : html`You entered: ${value}`}
      </div>
    </div>
  `;
}
