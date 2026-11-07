import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldClass, fieldContentClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      label: 'Share across devices',
      description:
        'Focus is shared across devices, and turns off when you leave the app.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      label: 'المشاركة عبر الأجهزة',
      description:
        'يتم مشاركة التركيز عبر الأجهزة، ويتم إيقاف تشغيله عند مغادرة التطبيق.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      label: 'שיתוף בין מכשירים',
      description: 'המיקוד משותף בין מכשירים, וכבה כשאתה עוזב את האפליקציה.',
    },
  },
};

export default function SwitchRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div role="group" data-slot="field" data-orientation="horizontal" dir=${dir} lang=${lang} class=${cn(fieldClass({ orientation: 'horizontal' }), 'max-w-sm')}>
      <div data-slot="field-content" class=${fieldContentClass()}>
        <label data-slot="field-label" for="switch-focus-mode-rtl" class=${fieldLabelClass()}>
          ${t.label}
        </label>
        <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.description}</p>
      </div>
      <ui-switch input-id="switch-focus-mode-rtl"></ui-switch>
    </div>
  `;
}
