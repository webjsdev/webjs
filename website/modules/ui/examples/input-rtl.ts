import { html } from '@webjsdev/core';
import { fieldClass, fieldLabelClass, fieldDescriptionClass } from '#modules/ui/components/field.ts';
import { inputClass } from '#modules/ui/components/input.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      apiKey: 'API Key',
      placeholder: 'sk-...',
      description: 'Your API key is encrypted and stored securely.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      apiKey: 'مفتاح API',
      placeholder: 'sk-...',
      description: 'مفتاح API الخاص بك مشفر ومخزن بأمان.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      apiKey: 'מפתח API',
      placeholder: 'sk-...',
      description: 'מפתח ה-API שלך מוצפן ונשמר בצורה מאובטחת.',
    },
  },
};

export default function InputRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div role="group" data-slot="field" data-orientation="vertical" dir=${dir} lang=${lang} class=${fieldClass()}>
      <label data-slot="field-label" for="input-rtl-api-key" class=${fieldLabelClass()}>${t.apiKey}</label>
      <input data-slot="input" id="input-rtl-api-key" type="password" placeholder=${t.placeholder} class=${inputClass()}>
      <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.description}</p>
    </div>
  `;
}
