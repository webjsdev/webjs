import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      trigger: 'Wireless Headphones',
      name: 'Wireless Headphones',
      price: '$99.99',
      left: 'Left',
      top: 'Top',
      bottom: 'Bottom',
      right: 'Right',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      trigger: 'سماعات لاسلكية',
      name: 'سماعات لاسلكية',
      price: '٩٩.٩٩ $',
      left: 'يسار',
      top: 'أعلى',
      bottom: 'أسفل',
      right: 'يمين',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      trigger: 'אוזניות אלחוטיות',
      name: 'אוזניות אלחוטיות',
      price: '99.99 $',
      left: 'שמאל',
      top: 'למעלה',
      bottom: 'למטה',
      right: 'ימין',
    },
  },
};

const physicalSides = ['left', 'top', 'bottom', 'right'] as const;

export default function HoverCardRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex flex-wrap justify-center gap-2" dir=${dir} lang=${lang}>
      ${physicalSides.map((side) => html`
        <ui-hover-card open-delay="10" close-delay="100">
          <ui-hover-card-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t[side]}</button>
          </ui-hover-card-trigger>
          <ui-hover-card-content side=${side} class="flex w-64 flex-col gap-1" dir=${dir}>
            <div data-slot="hover-card-title" class="font-semibold">${t.name}</div>
            <div class="text-sm text-muted-foreground">${t.price}</div>
          </ui-hover-card-content>
        </ui-hover-card>
      `)}
    </div>
  `;
}
