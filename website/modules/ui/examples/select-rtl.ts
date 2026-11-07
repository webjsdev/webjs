import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { selectTriggerClass } from '#modules/ui/components/select.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      selectFruit: 'Select a fruit',
      fruits: 'Fruits',
      apple: 'Apple',
      banana: 'Banana',
      blueberry: 'Blueberry',
      grapes: 'Grapes',
      pineapple: 'Pineapple',
      vegetables: 'Vegetables',
      carrot: 'Carrot',
      broccoli: 'Broccoli',
      spinach: 'Spinach',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      selectFruit: 'اختر فاكهة',
      fruits: 'الفواكه',
      apple: 'تفاح',
      banana: 'موز',
      blueberry: 'توت أزرق',
      grapes: 'عنب',
      pineapple: 'أناناس',
      vegetables: 'الخضروات',
      carrot: 'جزر',
      broccoli: 'بروكلي',
      spinach: 'سبانخ',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      selectFruit: 'בחר פרי',
      fruits: 'פירות',
      apple: 'תפוח',
      banana: 'בננה',
      blueberry: 'אוכמניה',
      grapes: 'ענבים',
      pineapple: 'אננס',
      vegetables: 'ירקות',
      carrot: 'גזר',
      broccoli: 'ברוקולי',
      spinach: 'תרד',
    },
  },
};

export default function SelectRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  const fruits = [
    { label: t.apple, value: 'apple' },
    { label: t.banana, value: 'banana' },
    { label: t.blueberry, value: 'blueberry' },
    { label: t.grapes, value: 'grapes' },
    { label: t.pineapple, value: 'pineapple' },
  ];

  const vegetables = [
    { label: t.carrot, value: 'carrot' },
    { label: t.broccoli, value: 'broccoli' },
    { label: t.spinach, value: 'spinach' },
  ];

  return html`
    <ui-select placeholder=${t.selectFruit} dir=${dir} lang=${lang}>
      <select name="food" aria-label=${t.selectFruit} class=${cn(selectTriggerClass(), 'w-32')}>
        <option value="" disabled selected hidden>${t.selectFruit}</option>
        <optgroup label=${t.fruits}>
          ${fruits.map((item) => html`<option value=${item.value}>${item.label}</option>`)}
        </optgroup>
        <hr>
        <optgroup label=${t.vegetables}>
          ${vegetables.map((item) => html`<option value=${item.value}>${item.label}</option>`)}
        </optgroup>
      </select>
    </ui-select>
  `;
}
