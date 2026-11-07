import { html } from '@webjsdev/core';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { labelClass } from '#modules/ui/components/label.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      label: 'Accept terms and conditions',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      label: 'قبول الشروط والأحكام',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      label: 'קבל תנאים והגבלות',
    },
  },
};

export default function LabelRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex gap-2" dir=${dir} lang=${lang}>
      <input type="checkbox" data-slot="checkbox" id="terms-rtl" class=${checkboxClass()}>
      <label data-slot="label" for="terms-rtl" class=${labelClass()}>${t.label}</label>
    </div>
  `;
}
