import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  drawerHeaderClass, drawerTitleClass, drawerDescriptionClass, drawerFooterClass,
} from '#modules/ui/components/drawer.ts';
import { MinusIcon, PlusIcon } from '#lib/ui/lucide.ts';

const data = [
  { goal: 400 },
  { goal: 300 },
  { goal: 200 },
  { goal: 300 },
  { goal: 200 },
  { goal: 278 },
  { goal: 189 },
  { goal: 239 },
  { goal: 300 },
  { goal: 200 },
  { goal: 278 },
  { goal: 189 },
  { goal: 349 },
];

const translations = {
  en: {
    dir: 'ltr',
    locale: 'en-US',
    values: {
      trigger: 'Open Drawer',
      title: 'Move Goal',
      description: 'Set your daily activity goal.',
      caloriesPerDay: 'Calories/day',
      decrease: 'Decrease',
      increase: 'Increase',
      submit: 'Submit',
      cancel: 'Cancel',
    },
  },
  ar: {
    dir: 'rtl',
    locale: 'ar-EG',
    values: {
      trigger: 'فتح الدرج',
      title: 'نقل الهدف',
      description: 'حدد هدف نشاطك اليومي.',
      caloriesPerDay: 'سعرات حرارية/يوم',
      decrease: 'تقليل',
      increase: 'زيادة',
      submit: 'إرسال',
      cancel: 'إلغاء',
    },
  },
  he: {
    dir: 'rtl',
    locale: 'he-IL',
    values: {
      trigger: 'פתח מגירה',
      title: 'הזז מטרה',
      description: 'הגדר את יעד הפעילות היומי שלך.',
      caloriesPerDay: 'קלוריות/יום',
      decrease: 'הקטן',
      increase: 'הגדל',
      submit: 'שלח',
      cancel: 'בטל',
    },
  },
};

// The bars are plain elements sized from the data, standing in for the
// Recharts BarChart shadcn's demo draws, in reading order for the direction.
export default function DrawerRtl() {
  const lang = 'ar';
  const { dir, locale, values: t } = translations[lang];
  const goal = 350;

  return html`
    <ui-drawer>
      <ui-drawer-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.trigger}</button>
      </ui-drawer-trigger>
      <ui-drawer-content dir=${dir} lang=${lang}>
        <div class="mx-auto w-full max-w-sm">
          <div data-slot="drawer-header" class=${drawerHeaderClass()}>
            <h2 data-slot="drawer-title" class=${drawerTitleClass()}>${t.title}</h2>
            <p data-slot="drawer-description" class=${drawerDescriptionClass()}>${t.description}</p>
          </div>
          <div class="p-4 pb-0">
            <div class="flex items-center justify-center space-x-2">
              <button type="button" data-slot="button" data-variant="outline" data-size="icon" ?disabled=${goal <= 200} class=${cn(buttonClass({ variant: 'outline', size: 'icon' }), 'h-8 w-8 shrink-0 rounded-full')}>
                ${MinusIcon()}
                <span class="sr-only">${t.decrease}</span>
              </button>
              <div class="flex-1 text-center">
                <div class="text-7xl font-bold tracking-tighter">${goal.toLocaleString(locale)}</div>
                <div class="text-[0.70rem] text-muted-foreground uppercase">${t.caloriesPerDay}</div>
              </div>
              <button type="button" data-slot="button" data-variant="outline" data-size="icon" ?disabled=${goal >= 400} class=${cn(buttonClass({ variant: 'outline', size: 'icon' }), 'h-8 w-8 shrink-0 rounded-full')}>
                ${PlusIcon()}
                <span class="sr-only">${t.increase}</span>
              </button>
            </div>
            <div class="mt-3 h-[120px]">
              <div aria-hidden="true" class="flex h-full items-end gap-1 p-1">
                ${data.map((d) => html`<div class="flex-1 bg-chart-2" style=${'height: ' + (d.goal / 400) * 100 + '%'}></div>`)}
              </div>
            </div>
          </div>
          <div data-slot="drawer-footer" class=${drawerFooterClass()}>
            <button type="button" data-slot="button" data-variant="default" data-size="default" class=${buttonClass()}>${t.submit}</button>
            <ui-drawer-close>
              <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.cancel}</button>
            </ui-drawer-close>
          </div>
        </div>
      </ui-drawer-content>
    </ui-drawer>
  `;
}
