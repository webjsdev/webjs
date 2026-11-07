import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  itemClass, itemActionsClass, itemContentClass, itemDescriptionClass,
  itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { BadgeCheckIcon, ChevronRightIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      basicItem: 'Basic Item',
      basicItemDesc: 'A simple item with title and description.',
      action: 'Action',
      verifiedTitle: 'Your profile has been verified.',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      basicItem: 'عنصر أساسي',
      basicItemDesc: 'عنصر بسيط يحتوي على عنوان ووصف.',
      action: 'إجراء',
      verifiedTitle: 'تم التحقق من ملفك الشخصي.',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      basicItem: 'פריט בסיסי',
      basicItemDesc: 'פריט פשוט עם כותרת ותיאור.',
      action: 'פעולה',
      verifiedTitle: 'הפרופיל שלך אומת.',
    },
  },
};

export default function ItemRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex w-full max-w-md flex-col gap-6" dir=${dir} lang=${lang}>
      <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>${t.basicItem}</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>${t.basicItemDesc}</p>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
            ${t.action}
          </button>
        </div>
      </div>
      <a href="#" data-slot="item" data-variant="outline" data-size="sm" class=${itemClass({ variant: 'outline', size: 'sm' })}>
        <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
          ${BadgeCheckIcon('size-5')}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>${t.verifiedTitle}</div>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          ${ChevronRightIcon('size-4')}
        </div>
      </a>
    </div>
  `;
}
