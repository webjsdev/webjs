import { html } from '@webjsdev/core';
import {
  CalculatorIcon, CalendarIcon, CreditCardIcon, SettingsIcon, SmileIcon, UserIcon,
} from '#lib/ui/lucide.ts';

const translations = {
  en: {
    dir: 'ltr',
    values: {
      placeholder: 'Type a command or search...',
      empty: 'No results found.',
      suggestions: 'Suggestions',
      calendar: 'Calendar',
      searchEmoji: 'Search Emoji',
      calculator: 'Calculator',
      settings: 'Settings',
      profile: 'Profile',
      billing: 'Billing',
    },
  },
  ar: {
    dir: 'rtl',
    values: {
      placeholder: 'اكتب أمرًا أو ابحث...',
      empty: 'لم يتم العثور على نتائج.',
      suggestions: 'اقتراحات',
      calendar: 'التقويم',
      searchEmoji: 'البحث عن الرموز التعبيرية',
      calculator: 'الآلة الحاسبة',
      settings: 'الإعدادات',
      profile: 'الملف الشخصي',
      billing: 'الفوترة',
    },
  },
  he: {
    dir: 'rtl',
    values: {
      placeholder: 'הקלד פקודה או חפש...',
      empty: 'לא נמצאו תוצאות.',
      suggestions: 'הצעות',
      calendar: 'לוח שנה',
      searchEmoji: "חפש אמוג'י",
      calculator: 'מחשבון',
      settings: 'הגדרות',
      profile: 'פרופיל',
      billing: 'חיוב',
    },
  },
};

// The provider is the dir attribute: every part styles itself with logical
// properties, so dir="rtl" on the command flips the whole menu.
export default function CommandRtl() {
  const lang = 'ar';
  const { dir, values: t } = translations[lang];

  return html`
    <ui-command label=${t.suggestions} dir=${dir} lang=${lang} class="max-w-sm rounded-lg border">
      <ui-command-input placeholder=${t.placeholder}></ui-command-input>
      <ui-command-list>
        <ui-command-empty>${t.empty}</ui-command-empty>
        <ui-command-group heading=${t.suggestions}>
          <ui-command-item>
            ${CalendarIcon()}
            <span>${t.calendar}</span>
          </ui-command-item>
          <ui-command-item>
            ${SmileIcon()}
            <span>${t.searchEmoji}</span>
          </ui-command-item>
          <ui-command-item disabled>
            ${CalculatorIcon()}
            <span>${t.calculator}</span>
          </ui-command-item>
        </ui-command-group>
        <ui-command-separator></ui-command-separator>
        <ui-command-group heading=${t.settings}>
          <ui-command-item>
            ${UserIcon()}
            <span>${t.profile}</span>
            <ui-command-shortcut>⌘P</ui-command-shortcut>
          </ui-command-item>
          <ui-command-item>
            ${CreditCardIcon()}
            <span>${t.billing}</span>
            <ui-command-shortcut>⌘B</ui-command-shortcut>
          </ui-command-item>
          <ui-command-item>
            ${SettingsIcon()}
            <span>${t.settings}</span>
            <ui-command-shortcut>⌘S</ui-command-shortcut>
          </ui-command-item>
        </ui-command-group>
      </ui-command-list>
    </ui-command>
  `;
}
