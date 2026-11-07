import { html } from '@webjsdev/core';
import { alertClass, alertTitleClass, alertDescriptionClass } from '#modules/ui/components/alert.ts';
import { CheckCircle2Icon, InfoIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      paymentTitle: 'Payment successful',
      paymentDescription:
        'Your payment of $29.99 has been processed. A receipt has been sent to your email address.',
      featureTitle: 'New feature available',
      featureDescription:
        "We've added dark mode support. You can enable it in your account settings.",
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      paymentTitle: 'تم الدفع بنجاح',
      paymentDescription:
        'تمت معالجة دفعتك البالغة 29.99 دولارًا. تم إرسال إيصال إلى عنوان بريدك الإلكتروني.',
      featureTitle: 'ميزة جديدة متاحة',
      featureDescription:
        'لقد أضفنا دعم الوضع الداكن. يمكنك تفعيله في إعدادات حسابك.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      paymentTitle: 'התשלום בוצע בהצלחה',
      paymentDescription:
        'התשלום שלך בסך 29.99 דולר עובד. קבלה נשלחה לכתובת האימייל שלך.',
      featureTitle: 'תכונה חדשה זמינה',
      featureDescription:
        'הוספנו תמיכה במצב כהה. אתה יכול להפעיל אותו בהגדרות החשבון שלך.',
    },
  },
};

const alerts = [
  { icon: CheckCircle2Icon, titleKey: 'paymentTitle', descriptionKey: 'paymentDescription' },
  { icon: InfoIcon, titleKey: 'featureTitle', descriptionKey: 'featureDescription' },
] as const;

export default function AlertRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="grid w-full max-w-md items-start gap-4" dir=${dir} lang=${lang}>
      ${alerts.map((alert) => html`
        <div data-slot="alert" role="alert" class=${alertClass()}>
          ${alert.icon()}
          <div data-slot="alert-title" class=${alertTitleClass()}>${t[alert.titleKey]}</div>
          <div data-slot="alert-description" class=${alertDescriptionClass()}>${t[alert.descriptionKey]}</div>
        </div>
      `)}
    </div>
  `;
}
