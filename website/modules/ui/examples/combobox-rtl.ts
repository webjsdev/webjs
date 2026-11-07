import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';

const categories = ['technology', 'design', 'business', 'marketing', 'education', 'health'] as const;

const translations = {
  en: {
    dir: 'ltr',
    values: {
      label: 'Categories',
      placeholder: 'Add categories',
      empty: 'No categories found.',
      technology: 'Technology',
      design: 'Design',
      business: 'Business',
      marketing: 'Marketing',
      education: 'Education',
      health: 'Health',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      label: 'الفئات',
      placeholder: 'أضف فئات',
      empty: 'لم يتم العثور على فئات.',
      technology: 'التكنولوجيا',
      design: 'التصميم',
      business: 'الأعمال',
      marketing: 'التسويق',
      education: 'التعليم',
      health: 'الصحة',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      label: 'קטגוריות',
      placeholder: 'הוסף קטגוריות',
      empty: 'לא נמצאו קטגוריות.',
      technology: 'טכנולוגיה',
      design: 'עיצוב',
      business: 'עסקים',
      marketing: 'שיווק',
      education: 'חינוך',
      health: 'בריאות',
    },
  },
};

// The provider is the dir attribute: every part styles itself with logical
// properties, so dir="rtl" on the field flips the whole control. A chip
// shows its item's label, so the values stay the English keys.
export default function ComboboxRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" dir=${dir} lang=${lang} class=${cn(fieldClass(), 'mx-auto w-full max-w-xs')}>
      <label data-slot="field-label" for="combobox-rtl" class=${fieldLabelClass()}>${t.label}</label>
      <ui-combobox multiple value=${categories[0]}>
        <ui-combobox-chips>
          <ui-combobox-chips-input input-id="combobox-rtl" placeholder=${t.placeholder}></ui-combobox-chips-input>
        </ui-combobox-chips>
        <ui-combobox-content dir=${dir}>
          <ui-combobox-empty>${t.empty}</ui-combobox-empty>
          <ui-combobox-list>
            ${categories.map((item) => html`<ui-combobox-item value=${item}>${t[item]}</ui-combobox-item>`)}
          </ui-combobox-list>
        </ui-combobox-content>
      </ui-combobox>
    </div>
  `;
}
