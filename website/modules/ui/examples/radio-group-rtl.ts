import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldClass, fieldContentClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';

// shadcn's demo switches language with a selector; the page shows its
// default, Arabic.
const translations = {
  en: {
    dir: 'ltr',
    values: {
      default: 'Default',
      defaultDescription: 'Standard spacing for most use cases.',
      comfortable: 'Comfortable',
      comfortableDescription: 'More space between elements.',
      compact: 'Compact',
      compactDescription: 'Minimal spacing for dense layouts.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      default: 'افتراضي',
      defaultDescription: 'تباعد قياسي لمعظم حالات الاستخدام.',
      comfortable: 'مريح',
      comfortableDescription: 'مساحة أكبر بين العناصر.',
      compact: 'مضغوط',
      compactDescription: 'تباعد أدنى للتخطيطات الكثيفة.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      default: 'ברירת מחדל',
      defaultDescription: 'ריווח סטנדרטי לרוב מקרי השימוש.',
      comfortable: 'נוח',
      comfortableDescription: 'יותר מקום בין האלמנטים.',
      compact: 'קומפקטי',
      compactDescription: 'ריווח מינימלי לפריסות צפופות.',
    },
  },
};

export default function RadioGroupRtl() {
  const { dir, values: t } = translations.ar;
  const options = [
    { value: 'default', id: 'r1-rtl', label: t.default, description: t.defaultDescription },
    { value: 'comfortable', id: 'r2-rtl', label: t.comfortable, description: t.comfortableDescription },
    { value: 'compact', id: 'r3-rtl', label: t.compact, description: t.compactDescription },
  ];

  return html`
    <div role="radiogroup" aria-label="التباعد" dir=${dir} data-slot="radio-group" class=${cn(radioGroupClass(), 'w-fit')}>
      ${options.map((option) => html`
        <div role="group" data-slot="field" data-orientation="horizontal" class=${fieldClass({ orientation: 'horizontal' })}>
          <input type="radio" data-slot="radio" name="radio-group-rtl" value=${option.value} id=${option.id} ?checked=${option.value === 'comfortable'} class=${radioClass()}>
          <div data-slot="field-content" class=${fieldContentClass()}>
            <label data-slot="field-label" for=${option.id} class=${fieldLabelClass()}>${option.label}</label>
            <p data-slot="field-description" class=${fieldDescriptionClass()}>${option.description}</p>
          </div>
        </div>
      `)}
    </div>
  `;
}
