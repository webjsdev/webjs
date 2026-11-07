import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

// February with the 3rd selected, each row led by its week number.
export default function CalendarWeekNumbers() {
  const year = new Date().getFullYear();

  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-fit p-0')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'p-0')}>
        <ui-calendar
          mode="single"
          value=${year + '-02-03'}
          month=${year + '-02'}
          show-week-number
        ></ui-calendar>
      </div>
    </div>
  `;
}
