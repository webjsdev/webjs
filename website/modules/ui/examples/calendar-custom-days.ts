import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

export default function CalendarCustomDays() {
  const year = new Date().getFullYear();

  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-fit p-0')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'p-0')}>
        <ui-calendar
          mode="range"
          value=${year + '-12-08/' + year + '-12-18'}
          month=${year + '-12'}
          caption-layout="dropdown"
          class="*:data-[slot=calendar]:[--cell-size:--spacing(10)] md:*:data-[slot=calendar]:[--cell-size:--spacing(12)]"
        ></ui-calendar>
      </div>
    </div>
  `;
}
