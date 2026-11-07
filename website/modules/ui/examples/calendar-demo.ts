import { html } from '@webjsdev/core';

/** Today as the calendar's value string, "YYYY-MM-DD". */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export default function CalendarDemo() {
  return html`
    <ui-calendar
      mode="single"
      value=${today()}
      class="rounded-lg border"
      caption-layout="dropdown"
    ></ui-calendar>
  `;
}
