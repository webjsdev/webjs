import { html } from '@webjsdev/core';

const locales = {
  ar: 'ar',
  he: 'he',
} as const;

const pad = (n: number) => String(n).padStart(2, '0');

// The provider is the dir attribute plus the locale: the calendar flips its
// arrows and range ends by logical side, and names its months and weekdays
// through Intl.DateTimeFormat in the language you pass.
export default function CalendarRtl() {
  const lang = 'ar';
  const now = new Date();
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  return html`
    <ui-calendar
      mode="single"
      value=${today}
      caption-layout="dropdown"
      dir="rtl"
      lang=${lang}
      locale=${locales[lang]}
      class="rounded-lg border *:data-[slot=calendar]:[--cell-size:--spacing(9)]"
    ></ui-calendar>
  `;
}
