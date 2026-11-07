import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { fieldGroupClass, fieldClass, fieldLabelClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import {
  sheetHeaderClass, sheetFooterClass, sheetTitleClass, sheetDescriptionClass,
} from '#modules/ui/components/sheet.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      open: 'Open',
      editProfile: 'Edit profile',
      description:
        "Make changes to your profile here. Click save when you're done.",
      name: 'Name',
      username: 'Username',
      save: 'Save changes',
      close: 'Close',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      open: 'فتح',
      editProfile: 'تعديل الملف الشخصي',
      description:
        'قم بإجراء تغييرات على ملفك الشخصي هنا. انقر حفظ عند الانتهاء.',
      name: 'الاسم',
      username: 'اسم المستخدم',
      save: 'حفظ التغييرات',
      close: 'إغلاق',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      open: 'פתח',
      editProfile: 'עריכת פרופיל',
      description: 'בצע שינויים בפרופיל שלך כאן. לחץ שמור כשתסיים.',
      name: 'שם',
      username: 'שם משתמש',
      save: 'שמור שינויים',
      close: 'סגור',
    },
  },
};

export default function SheetRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-sheet>
      <ui-sheet-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.open}</button>
      </ui-sheet-trigger>
      <ui-sheet-content dir=${dir} lang=${lang} side=${dir === 'rtl' ? 'left' : 'right'}>
        <div data-slot="sheet-header" class=${sheetHeaderClass()}>
          <h2 data-slot="sheet-title" class=${sheetTitleClass()}>${t.editProfile}</h2>
          <p data-slot="sheet-description" class=${sheetDescriptionClass()}>${t.description}</p>
        </div>
        <div data-slot="field-group" class=${cn(fieldGroupClass(), 'px-4')}>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="sheet-rtl-name" class=${fieldLabelClass()}>${t.name}</label>
            <input data-slot="input" id="sheet-rtl-name" value="Pedro Duarte" class=${inputClass()}>
          </div>
          <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
            <label data-slot="field-label" for="sheet-rtl-username" class=${fieldLabelClass()}>${t.username}</label>
            <input data-slot="input" id="sheet-rtl-username" value="peduarte" class=${inputClass()}>
          </div>
        </div>
        <div data-slot="sheet-footer" class=${sheetFooterClass()}>
          <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>${t.save}</button>
          <ui-sheet-close>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.close}</button>
          </ui-sheet-close>
        </div>
      </ui-sheet-content>
    </ui-sheet>
  `;
}
