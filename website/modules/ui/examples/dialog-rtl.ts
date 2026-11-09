import { html, nothing } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  dialogHeaderClass, dialogTitleClass, dialogDescriptionClass, dialogFooterClass,
} from '#modules/ui/components/dialog.ts';
import { fieldGroupClass, fieldClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';
import { labelClass } from '#modules/ui/components/label.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      openDialog: 'Open Dialog',
      editProfile: 'Edit profile',
      description: "Make changes to your profile here. Click save when you're done.",
      name: 'Name',
      username: 'Username',
      cancel: 'Cancel',
      saveChanges: 'Save changes',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      openDialog: 'فتح الحوار',
      editProfile: 'تعديل الملف الشخصي',
      description: 'قم بإجراء تغييرات على ملفك الشخصي هنا. انقر فوق حفظ عند الانتهاء.',
      name: 'الاسم',
      username: 'اسم المستخدم',
      cancel: 'إلغاء',
      saveChanges: 'حفظ التغييرات',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      openDialog: 'פתח דיאלוג',
      editProfile: 'ערוך פרופיל',
      description: 'בצע שינויים בפרופיל שלך כאן. לחץ על שמור כשתסיים.',
      name: 'שם',
      username: 'שם משתמש',
      cancel: 'בטל',
      saveChanges: 'שמור שינויים',
    },
  },
};

// The provider is the dir attribute: dir="rtl" on the content flips the
// panel, its close button and every part inside it.
export default function DialogRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-dialog>
      <form>
        <ui-dialog-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.openDialog}</button>
        </ui-dialog-trigger>
        <ui-dialog-content class="sm:max-w-sm" dir=${dir} data-lang=${dir === 'rtl' ? lang : nothing}>
          <div data-slot="dialog-header" class=${dialogHeaderClass()}>
            <h2 data-slot="dialog-title" class=${dialogTitleClass()}>${t.editProfile}</h2>
            <p data-slot="dialog-description" class=${dialogDescriptionClass()}>${t.description}</p>
          </div>
          <div data-slot="field-group" class=${fieldGroupClass()}>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="label" for="name-rtl" class=${labelClass()}>${t.name}</label>
              <input data-slot="input" id="name-rtl" name="name" value="Pedro Duarte" class=${inputClass()}>
            </div>
            <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
              <label data-slot="label" for="username-rtl" class=${labelClass()}>${t.username}</label>
              <input data-slot="input" id="username-rtl" name="username" value="@peduarte" class=${inputClass()}>
            </div>
          </div>
          <div data-slot="dialog-footer" class=${dialogFooterClass()}>
            <ui-dialog-close>
              <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.cancel}</button>
            </ui-dialog-close>
            <button type="submit" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>${t.saveChanges}</button>
          </div>
        </ui-dialog-content>
      </form>
    </ui-dialog>
  `;
}
