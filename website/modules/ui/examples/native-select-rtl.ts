import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  nativeSelectWrapperClass, nativeSelectClass, nativeSelectIconClass,
} from '#modules/ui/components/native-select.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

// shadcn's demo switches language with a selector; the page shows its
// default, Arabic. Its RTL build turns the style's physical padding and
// chevron position into logical ones, so the rtl: classes do that here.
const translations = {
  en: {
    dir: 'ltr',
    values: { placeholder: 'Select status', todo: 'Todo', inProgress: 'In Progress', done: 'Done', cancelled: 'Cancelled' },
  },
  ar: {
    dir: 'rtl',
    values: { placeholder: 'اختر الحالة', todo: 'مهام', inProgress: 'قيد التنفيذ', done: 'منجز', cancelled: 'ملغي' },
  },
  he: {
    dir: 'rtl',
    values: { placeholder: 'בחר סטטוס', todo: 'לעשות', inProgress: 'בתהליך', done: 'הושלם', cancelled: 'בוטל' },
  },
};

export default function NativeSelectRtl() {
  const { dir, values: t } = translations.ar;
  return html`
    <div data-slot="native-select-wrapper" data-size="default" class=${nativeSelectWrapperClass()}>
      <select data-slot="native-select" data-size="default" dir=${dir} aria-label=${t.placeholder} class=${cn(nativeSelectClass(), 'rtl:pr-2.5 rtl:pl-8')}>
        <option data-slot="native-select-option" value="">${t.placeholder}</option>
        <option data-slot="native-select-option" value="todo">${t.todo}</option>
        <option data-slot="native-select-option" value="in-progress">${t.inProgress}</option>
        <option data-slot="native-select-option" value="done">${t.done}</option>
        <option data-slot="native-select-option" value="cancelled">${t.cancelled}</option>
      </select>
      ${ChevronDownIcon(cn(nativeSelectIconClass(), 'rtl:right-auto rtl:left-2.5'))}
    </div>
  `;
}
