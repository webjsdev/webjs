import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { cardClass, cardContentClass } from '#modules/ui/components/card.ts';

const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarRange() {
  const now = new Date();
  const year = now.getFullYear();
  const today = year + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  return html`
    <div data-slot="card" data-size="default" class=${cn(cardClass(), 'mx-auto w-fit p-0')}>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'p-0')}>
        <ui-calendar
          mode="range"
          value=${year + '-01-12/' + year + '-02-11'}
          month=${year + '-01'}
          number-of-months="2"
          min="1900-01-01"
          max=${today}
        ></ui-calendar>
      </div>
    </div>
  `;
}
