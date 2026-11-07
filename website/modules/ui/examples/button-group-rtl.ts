import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import {
  ArchiveIcon, ArrowLeftIcon, CalendarPlusIcon, ClockIcon, ListFilterIcon,
  MailCheckIcon, MoreHorizontalIcon, TagIcon, Trash2Icon,
} from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      archive: 'Archive',
      report: 'Report',
      snooze: 'Snooze',
      markAsRead: 'Mark as Read',
      addToCalendar: 'Add to Calendar',
      addToList: 'Add to List',
      labelAs: 'Label As...',
      personal: 'Personal',
      work: 'Work',
      other: 'Other',
      trash: 'Trash',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      archive: 'أرشفة',
      report: 'تقرير',
      snooze: 'تأجيل',
      markAsRead: 'وضع علامة كمقروء',
      addToCalendar: 'إضافة إلى التقويم',
      addToList: 'إضافة إلى القائمة',
      labelAs: 'تصنيف كـ...',
      personal: 'شخصي',
      work: 'عمل',
      other: 'آخر',
      trash: 'سلة المهملات',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      archive: 'ארכיון',
      report: 'דוח',
      snooze: 'דחה',
      markAsRead: 'סמן כנקרא',
      addToCalendar: 'הוסף ליומן',
      addToList: 'הוסף לרשימה',
      labelAs: 'תייג כ...',
      personal: 'אישי',
      work: 'עבודה',
      other: 'אחר',
      trash: 'פח',
    },
  },
};

// The provider is the dir attribute: the group flattens its corners by
// logical side, and the menu opens in the top layer but stays in the
// document, so both inherit dir="rtl" from the wrapper.
export default function ButtonGroupRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <div dir=${dir} lang=${lang}>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'hidden sm:flex')}>
          <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Go Back" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
            ${ArrowLeftIcon('rtl:rotate-180')}
          </button>
        </div>
        <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.archive}</button>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.report}</button>
        </div>
        <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>${t.snooze}</button>
          <button type="button" id="button-group-rtl-more" data-slot="button" data-variant="outline" data-size="icon" aria-label="More Options" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
            ${MoreHorizontalIcon()}
          </button>
        </div>
      </div>
      <ui-dropdown-menu trigger="button-group-rtl-more" class="absolute">
        <ui-dropdown-menu-content align="end" class="w-40">
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-item>
              ${MailCheckIcon()}
              ${t.markAsRead}
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item>
              ${ArchiveIcon()}
              ${t.archive}
            </ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-item>
              ${ClockIcon()}
              ${t.snooze}
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item>
              ${CalendarPlusIcon()}
              ${t.addToCalendar}
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item>
              ${ListFilterIcon()}
              ${t.addToList}
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-sub>
              <ui-dropdown-menu-sub-trigger>
                ${TagIcon()}
                ${t.labelAs}
              </ui-dropdown-menu-sub-trigger>
              <ui-dropdown-menu-sub-content>
                <ui-dropdown-menu-group aria-label=${t.labelAs}>
                  <ui-dropdown-menu-item type="radio" value="personal" checked>${t.personal}</ui-dropdown-menu-item>
                  <ui-dropdown-menu-item type="radio" value="work">${t.work}</ui-dropdown-menu-item>
                  <ui-dropdown-menu-item type="radio" value="other">${t.other}</ui-dropdown-menu-item>
                </ui-dropdown-menu-group>
              </ui-dropdown-menu-sub-content>
            </ui-dropdown-menu-sub>
          </ui-dropdown-menu-group>
          <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
          <ui-dropdown-menu-group>
            <ui-dropdown-menu-item variant="destructive">
              ${Trash2Icon()}
              ${t.trash}
            </ui-dropdown-menu-item>
          </ui-dropdown-menu-group>
        </ui-dropdown-menu-content>
      </ui-dropdown-menu>
    </div>
  `;
}
