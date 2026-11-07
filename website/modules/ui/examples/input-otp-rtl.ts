import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      verificationCode: 'Verification code',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      verificationCode: 'رمز التحقق',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      verificationCode: 'קוד אימות',
    },
  },
};

export default function InputOTPRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" dir=${dir} lang=${lang} class=${cn(fieldClass(), 'mx-auto max-w-xs')}>
      <label data-slot="field-label" for="input-otp-rtl" class=${fieldLabelClass()}>${t.verificationCode}</label>
      <ui-input-otp dir=${dir}>
        <input id="input-otp-rtl" value="123456" class=${inputClass()} maxlength="6" inputmode="numeric" autocomplete="one-time-code">
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
