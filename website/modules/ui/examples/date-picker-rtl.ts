import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { popoverContentClass } from '#modules/ui/components/popover.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: { dir: 'ltr', values: { placeholder: 'Pick a date' } },
  ar: { dir: 'rtl', values: { placeholder: 'اختر تاريخًا' } },
  he: { dir: 'rtl', values: { placeholder: 'בחר תאריך' } },
};

// The calendar names its months and days through Intl in the given locale,
// and dir="rtl" flips the grid, the arrow keys and the navigation buttons.
export default function DatePickerRtl() {
  const language = 'ar';
  const { dir, values: t } = translations[language];

  return html`
    <button
      type="button"
      popovertarget="date-picker-rtl"
      aria-haspopup="dialog"
      aria-expanded="false"
      data-empty="true"
      dir=${dir}
      data-slot="button"
      data-variant="outline"
      data-size="default"
      class=${cn(buttonClass({ variant: 'outline' }), 'w-[212px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground')}
    >
      <span>${t.placeholder}</span>
      ${ChevronDownIcon()}
    </button>
    <div id="date-picker-rtl" popover role="dialog" aria-label=${t.placeholder} dir=${dir} data-slot="popover-content" class=${cn(popoverContentClass({ align: 'start' }), 'w-auto p-0')}>
      <ui-calendar mode="single" locale=${language} dir=${dir}></ui-calendar>
    </div>
  `;
}
