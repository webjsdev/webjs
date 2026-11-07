import { html } from '@webjsdev/core';

// <ui-calendar> lays its grid out in the Gregorian calendar and names it
// through Intl.DateTimeFormat, so a Persian locale gives Persian month and
// weekday names over Gregorian dates. The -u-ca-gregory extension keeps the
// caption on the same calendar as the grid.
export default function CalendarHijri() {
  return html`
    <div dir="rtl" lang="fa">
      <ui-calendar
        mode="single"
        value="2025-06-12"
        month="2025-06"
        locale="fa-IR-u-ca-gregory"
        class="rounded-lg border"
      ></ui-calendar>
    </div>
  `;
}
