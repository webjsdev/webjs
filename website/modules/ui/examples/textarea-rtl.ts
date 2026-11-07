import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { textareaClass } from '#modules/ui/components/textarea.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      label: 'Feedback',
      placeholder: 'Your feedback helps us improve...',
      description: 'Share your thoughts about our service.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      label: 'التعليقات',
      placeholder: 'تعليقاتك تساعدنا على التحسين...',
      description: 'شاركنا أفكارك حول خدمتنا.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      label: 'משוב',
      placeholder: 'המשוב שלך עוזר לנו להשתפר...',
      description: 'שתף את מחשבותיך על השירות שלנו.',
    },
  },
};

// The provider is the dir attribute: the field styles itself with logical
// properties, so dir="rtl" on it flips the whole layout.
export default function TextareaRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" dir=${dir} lang=${lang} class=${cn(fieldClass(), 'w-full max-w-xs')}>
      <label data-slot="field-label" for="feedback" class=${fieldLabelClass()}>${t.label}</label>
      <textarea data-slot="textarea" id="feedback" placeholder=${t.placeholder} rows="4" class=${textareaClass()}></textarea>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.description}</p>
    </div>
  `;
}
