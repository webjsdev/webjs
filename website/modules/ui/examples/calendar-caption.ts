import { html } from '@webjsdev/core';

export default function CalendarCaption() {
  return html`
    <ui-calendar
      mode="single"
      caption-layout="dropdown"
      class="rounded-lg border"
    ></ui-calendar>
  `;
}
