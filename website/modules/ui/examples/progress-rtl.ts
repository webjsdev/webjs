import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { progressClass } from '#modules/ui/components/progress.ts';

// shadcn's demo switches language with a selector; the page shows its
// default, Arabic, with Arabic numerals. shadcn rotates its bar under rtl
// because Radix draws it with divs; a native <progress> already fills from
// the right in a right-to-left page.
const translations = {
  en: { dir: 'ltr', values: { label: 'Upload progress' } },
  ar: { dir: 'rtl', values: { label: 'تقدم الرفع' } },
  he: { dir: 'rtl', values: { label: 'התקדמות העלאה' } },
};

const ARABIC_NUMERALS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toArabicNumerals = (num: number) =>
  num.toString().split('').map((digit) => ARABIC_NUMERALS[Number(digit)]).join('');

export default function ProgressRtl() {
  const { dir, values: t } = translations.ar;
  return html`
    <div role="group" data-slot="field" data-orientation="vertical" dir=${dir} class=${cn(fieldClass(), 'w-full max-w-sm')}>
      <label data-slot="field-label" for="progress-upload-rtl" class=${fieldLabelClass()}>
        <span>${t.label}</span>
        <span class="ms-auto">${toArabicNumerals(66)}%</span>
      </label>
      <progress data-slot="progress" id="progress-upload-rtl" value="66" max="100" class=${progressClass()}></progress>
    </div>
  `;
}
