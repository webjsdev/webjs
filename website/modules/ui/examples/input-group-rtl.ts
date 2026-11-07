import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  fieldGroupClass, fieldClass, fieldLabelClass, fieldDescriptionClass,
} from '#modules/ui/components/field.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
  inputGroupTextClass, inputGroupTextareaClass,
} from '#modules/ui/components/input-group.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import { SearchIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      placeholder: 'Search...',
      results: '12 results',
      searching: 'Searching...',
      saving: 'Saving...',
      savingChanges: 'Saving changes...',
      textareaLabel: 'Textarea',
      textareaPlaceholder: 'Write a comment...',
      characterCount: '0/280',
      post: 'Post',
      textareaDescription: 'Footer positioned below the textarea.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      placeholder: 'بحث...',
      results: '١٢ نتيجة',
      searching: 'جاري البحث...',
      saving: 'جاري الحفظ...',
      savingChanges: 'جاري حفظ التغييرات...',
      textareaLabel: 'منطقة النص',
      textareaPlaceholder: 'اكتب تعليقًا...',
      characterCount: '٠/٢٨٠',
      post: 'نشر',
      textareaDescription: 'تذييل موضع أسفل منطقة النص.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      placeholder: 'חפש...',
      results: '12 תוצאות',
      searching: 'מחפש...',
      saving: 'שומר...',
      savingChanges: 'שומר שינויים...',
      textareaLabel: 'אזור טקסט',
      textareaPlaceholder: 'כתוב תגובה...',
      characterCount: '0/280',
      post: 'פרסם',
      textareaDescription: 'כותרת תחתונה ממוקמת מתחת לאזור הטקסט.',
    },
  },
};

export default function InputGroupRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="grid w-full max-w-sm gap-6" dir=${dir} lang=${lang}>
      <div data-slot="input-group" role="group" class=${cn(inputGroupClass(), 'max-w-xs')}>
        <input data-slot="input-group-control" id="input-group-rtl-search" placeholder=${t.placeholder} aria-label=${t.placeholder} class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-start" for="input-group-rtl-search" class=${inputGroupAddonClass()}>
          ${SearchIcon()}
        </label>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-rtl-search" class=${inputGroupAddonClass({ align: 'inline-end' })}>${t.results}</label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-rtl-searching" placeholder=${t.searching} aria-label=${t.searching} class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-rtl-searching" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          ${spinner()}
        </label>
      </div>
      <div data-slot="input-group" role="group" class=${inputGroupClass()}>
        <input data-slot="input-group-control" id="input-group-rtl-saving" placeholder=${t.savingChanges} aria-label=${t.savingChanges} class=${inputGroupInputClass()}>
        <label data-slot="input-group-addon" data-align="inline-end" for="input-group-rtl-saving" class=${inputGroupAddonClass({ align: 'inline-end' })}>
          <span class=${inputGroupTextClass()}>${t.saving}</span>
          ${spinner({ decorative: true })}
        </label>
      </div>
      <div data-slot="field-group" class=${cn(fieldGroupClass(), 'max-w-sm')}>
        <div role="group" data-slot="field" data-orientation="vertical" class=${fieldClass()}>
          <label data-slot="field-label" for="rtl-textarea" class=${fieldLabelClass()}>${t.textareaLabel}</label>
          <div data-slot="input-group" role="group" class=${inputGroupClass()}>
            <textarea data-slot="input-group-control" id="rtl-textarea" placeholder=${t.textareaPlaceholder} class=${inputGroupTextareaClass()}></textarea>
            <div role="group" data-slot="input-group-addon" data-align="block-end" class=${inputGroupAddonClass({ align: 'block-end' })}>
              <span class=${inputGroupTextClass()}>${t.characterCount}</span>
              <button type="button" data-slot="button" data-variant="default" data-size="sm" class=${cn(inputGroupButtonClass({ variant: 'default', size: 'sm' }), 'ml-auto')}>
                ${t.post}
              </button>
            </div>
          </div>
          <p data-slot="field-description" class=${fieldDescriptionClass()}>${t.textareaDescription}</p>
        </div>
      </div>
    </div>
  `;
}
