import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  popoverContentClass, popoverHeaderClass, popoverTitleClass, popoverDescriptionClass,
  type PopoverSide,
} from '#modules/ui/components/popover.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      title: 'Dimensions',
      description: 'Set the dimensions for the layer.',
      left: 'Left',
      top: 'Top',
      bottom: 'Bottom',
      right: 'Right',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      title: 'الأبعاد',
      description: 'تعيين الأبعاد للطبقة.',
      left: 'يسار',
      top: 'أعلى',
      bottom: 'أسفل',
      right: 'يمين',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      title: 'מימדים',
      description: 'הגדר את המימדים לשכבה.',
      left: 'שמאל',
      top: 'למעלה',
      bottom: 'למטה',
      right: 'ימין',
    },
  },
};

const physicalSides: PopoverSide[] = ['left', 'top', 'bottom', 'right'];

// The provider is the dir attribute on each panel, as in shadcn's demo.
export default function PopoverRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  const sidePopover = (side: PopoverSide) => {
    const id = 'popover-rtl-' + side;
    return html`
      <button type="button" popovertarget=${id} aria-haspopup="dialog" aria-expanded="false" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t[side]}</button>
      <div id=${id} popover role="dialog" dir=${dir} lang=${lang} aria-labelledby=${id + '-title'} data-slot="popover-content" data-side=${side} data-align="center" class=${popoverContentClass({ side })}>
        <div data-slot="popover-header" class=${popoverHeaderClass()}>
          <h3 id=${id + '-title'} data-slot="popover-title" class=${popoverTitleClass()}>${t.title}</h3>
          <p data-slot="popover-description" class=${popoverDescriptionClass()}>${t.description}</p>
        </div>
      </div>
    `;
  };

  return html`
    <div class="flex flex-wrap justify-center gap-2">
      ${physicalSides.map(sidePopover)}
    </div>
  `;
}
