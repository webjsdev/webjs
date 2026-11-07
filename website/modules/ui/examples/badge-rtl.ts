import { html } from '@webjsdev/core';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { BadgeCheck, BookmarkIcon } from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      badge: 'Badge',
      secondary: 'Secondary',
      destructive: 'Destructive',
      outline: 'Outline',
      verified: 'Verified',
      bookmark: 'Bookmark',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      badge: 'شارة',
      secondary: 'ثانوي',
      destructive: 'مدمر',
      outline: 'مخطط',
      verified: 'متحقق',
      bookmark: 'إشارة مرجعية',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      badge: 'תג',
      secondary: 'משני',
      destructive: 'הרסני',
      outline: 'קווי מתאר',
      verified: 'מאומת',
      bookmark: 'סימנייה',
    },
  },
};

export default function BadgeRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div class="flex w-full flex-wrap justify-center gap-2" dir=${dir} lang=${lang}>
      <span data-slot="badge" data-variant="default" class=${badgeClass()}>${t.badge}</span>
      <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>${t.secondary}</span>
      <span data-slot="badge" data-variant="destructive" class=${badgeClass({ variant: 'destructive' })}>${t.destructive}</span>
      <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>${t.outline}</span>
      <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>
        ${BadgeCheck()}
        ${t.verified}
      </span>
      <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>
        ${t.bookmark}
        ${BookmarkIcon()}
      </span>
    </div>
  `;
}
