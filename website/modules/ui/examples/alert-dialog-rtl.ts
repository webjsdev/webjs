import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  alertDialogHeaderClass, alertDialogFooterClass, alertDialogTitleClass, alertDialogDescriptionClass,
  alertDialogMediaClass,
} from '#modules/ui/components/alert-dialog.ts';
import { BluetoothIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      showDialog: 'Show Dialog',
      showDialogSm: 'Show Dialog (sm)',
      title: 'Are you absolutely sure?',
      description:
        'This action cannot be undone. This will permanently delete your account from our servers.',
      cancel: 'Cancel',
      continue: 'Continue',
      smallTitle: 'Allow accessory to connect?',
      smallDescription:
        'Do you want to allow the USB accessory to connect to this device?',
      dontAllow: "Don't allow",
      allow: 'Allow',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      showDialog: 'إظهار الحوار',
      showDialogSm: 'إظهار الحوار (صغير)',
      title: 'هل أنت متأكد تمامًا؟',
      description:
        'لا يمكن التراجع عن هذا الإجراء. سيؤدي هذا إلى حذف حسابك نهائيًا من خوادمنا.',
      cancel: 'إلغاء',
      continue: 'متابعة',
      smallTitle: 'السماح للملحق بالاتصال؟',
      smallDescription: 'هل تريد السماح لملحق USB بالاتصال بهذا الجهاز؟',
      dontAllow: 'عدم السماح',
      allow: 'السماح',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      showDialog: 'הצג דיאלוג',
      showDialogSm: 'הצג דיאלוג (קטן)',
      title: 'האם אתה בטוח לחלוטין?',
      description:
        'פעולה זו לא ניתנת לביטול. זה ימחק לצמיתות את החשבון שלך מהשרתים שלנו.',
      cancel: 'ביטול',
      continue: 'המשך',
      smallTitle: 'לאפשר להתקן להתחבר?',
      smallDescription: 'האם אתה רוצה לאפשר להתקן USB להתחבר למכשיר זה?',
      dontAllow: 'אל תאפשר',
      allow: 'אפשר',
    },
  },
};

export default function AlertDialogRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex gap-4" dir=${dir} lang=${lang}>
      <ui-alert-dialog>
        <ui-alert-dialog-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.showDialog}</button>
        </ui-alert-dialog-trigger>
        <ui-alert-dialog-content dir=${dir} data-lang=${lang}>
          <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
            <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>${t.title}</h2>
            <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>${t.description}</p>
          </div>
          <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
            <ui-alert-dialog-cancel>${t.cancel}</ui-alert-dialog-cancel>
            <ui-alert-dialog-action>${t.continue}</ui-alert-dialog-action>
          </div>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
      <ui-alert-dialog>
        <ui-alert-dialog-trigger>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.showDialogSm}</button>
        </ui-alert-dialog-trigger>
        <ui-alert-dialog-content size="sm" dir=${dir} data-lang=${lang}>
          <div data-slot="alert-dialog-header" class=${alertDialogHeaderClass()}>
            <div data-slot="alert-dialog-media" aria-hidden="true" class=${alertDialogMediaClass()}>
              ${BluetoothIcon()}
            </div>
            <h2 data-slot="alert-dialog-title" class=${alertDialogTitleClass()}>${t.smallTitle}</h2>
            <p data-slot="alert-dialog-description" class=${alertDialogDescriptionClass()}>${t.smallDescription}</p>
          </div>
          <div data-slot="alert-dialog-footer" class=${alertDialogFooterClass()}>
            <ui-alert-dialog-cancel>${t.dontAllow}</ui-alert-dialog-cancel>
            <ui-alert-dialog-action>${t.allow}</ui-alert-dialog-action>
          </div>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    </div>
  `;
}
