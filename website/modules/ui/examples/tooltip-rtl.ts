import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      content: 'Add to library',
      left: 'Left',
      top: 'Top',
      bottom: 'Bottom',
      right: 'Right',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      content: 'إضافة إلى المكتبة',
      left: 'يسار',
      top: 'أعلى',
      bottom: 'أسفل',
      right: 'يمين',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      content: 'הוסף לספרייה',
      left: 'שמאל',
      top: 'למעלה',
      bottom: 'למטה',
      right: 'ימין',
    },
  },
};

const sides = ['left', 'top', 'bottom', 'right'] as const;

// The provider is the dir attribute on the wrapper, so the buttons and the
// tips inside it render right to left.
export default function TooltipRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div dir=${dir} lang=${lang} class="flex flex-wrap gap-2">
      ${sides.map((side) => html`
        <ui-tooltip>
          <ui-tooltip-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-fit capitalize')}>
              ${t[side]}
            </button>
          </ui-tooltip-trigger>
          <ui-tooltip-content side=${side}>${t.content}</ui-tooltip-content>
        </ui-tooltip>
      `)}
    </div>
  `;
}
