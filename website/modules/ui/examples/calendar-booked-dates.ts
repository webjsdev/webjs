import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

// <ui-calendar> disables the days outside its min / max window. It takes no
// list of single days, so here the bookings from the 12th onwards close the
// rest of February through `max`.
export default function CalendarBookedDates() {
  const year = new Date().getFullYear();

  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-fit p-0')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'p-0')}>
        <ui-calendar
          mode="single"
          value=${year + '-02-03'}
          month=${year + '-02'}
          max=${year + '-02-11'}
        ></ui-calendar>
      </div>
    </div>
  `;
}
