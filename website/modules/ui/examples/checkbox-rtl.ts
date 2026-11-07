import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import {
  fieldGroupClass, fieldClass, fieldContentClass, fieldLabelClass,
  fieldTitleClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { labelClass } from '#modules/ui/components/label.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      acceptTerms: 'Accept terms and conditions',
      acceptTermsDescription: 'By clicking this checkbox, you agree to the terms.',
      enableNotifications: 'Enable notifications',
      enableNotificationsDescription: 'You can enable or disable notifications at any time.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      acceptTerms: 'قبول الشروط والأحكام',
      acceptTermsDescription: 'بالنقر على هذا المربع، فإنك توافق على الشروط.',
      enableNotifications: 'تفعيل الإشعارات',
      enableNotificationsDescription: 'يمكنك تفعيل أو إلغاء تفعيل الإشعارات في أي وقت.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      acceptTerms: 'קבל תנאים והגבלות',
      acceptTermsDescription: 'על ידי לחיצה על תיבת הסימון הזו, אתה מסכים לתנאים.',
      enableNotifications: 'הפעל התראות',
      enableNotificationsDescription: 'אתה יכול להפעיל או להשבית התראות בכל עת.',
    },
  },
};

// The provider is the dir attribute: every part styles itself with logical
// properties, so dir="rtl" on the group flips the whole layout.
export default function CheckboxRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div data-slot="field-group" dir=${dir} lang=${lang} class=${cn(fieldGroupClass(), 'max-w-sm')}>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="terms-checkbox-rtl" name="terms-checkbox" class=${checkboxClass()}>
        <label data-slot="label" for="terms-checkbox-rtl" class=${labelClass()}>${t.acceptTerms}</label>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="terms-checkbox-2-rtl" name="terms-checkbox-2" checked class=${checkboxClass()}>
        <div data-slot="field-content" class=${fieldContentClass()}>
          <label data-slot="field-label" for="terms-checkbox-2-rtl" class=${fieldLabelClass()}>${t.acceptTerms}</label>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.acceptTermsDescription}</p>
        </div>
      </div>
      <div role="group" data-slot="field" data-orientation="horizontal" data-disabled="true" class=${fieldClass({ orientation: 'horizontal' })}>
        <input type="checkbox" data-slot="checkbox" id="toggle-checkbox-rtl" name="toggle-checkbox" disabled class=${checkboxClass()}>
        <label data-slot="field-label" for="toggle-checkbox-rtl" class=${fieldLabelClass()}>${t.enableNotifications}</label>
      </div>
      <label data-slot="field-label" class=${fieldLabelClass()}>
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <input type="checkbox" data-slot="checkbox" id="toggle-checkbox-2-rtl" name="toggle-checkbox-2" class=${checkboxClass()}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <div data-slot="field-label" class=${fieldTitleClass()}>${t.enableNotifications}</div>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.enableNotificationsDescription}</p>
          </div>
        </div>
      </label>
    </div>
  `;
}
