import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { cardClass, cardContentClass, cardFooterClass } from '#modules/ui/components/card.ts';

const pad = (n: number) => String(n).padStart(2, '0');

const PRESETS = [
  { label: 'Today', value: 0 },
  { label: 'Tomorrow', value: 1 },
  { label: 'In 3 days', value: 3 },
  { label: 'In a week', value: 7 },
  { label: 'In 2 weeks', value: 14 },
];

// Each preset button carries its offset in days. Wiring the click (set the
// calendar's value and month to today plus the offset) is a few lines in the
// component that owns this card.
export default function CalendarWithPresets() {
  const now = new Date();
  const year = now.getFullYear();

  return html`
    <div data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'mx-auto w-fit max-w-[300px]')}>
      <div data-slot="card-content" class=${cardContentClass()}>
        <ui-calendar
          mode="single"
          value=${year + '-02-12'}
          month=${year + '-' + pad(now.getMonth() + 1)}
          class="*:data-[slot=calendar]:p-0 *:data-[slot=calendar]:[--cell-size:--spacing(9.5)]"
        ></ui-calendar>
      </div>
      <div data-slot="card-footer" class=${cn(cardFooterClass(), 'flex flex-wrap gap-2 border-t')}>
        ${PRESETS.map((preset) => html`
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" data-days=${preset.value} class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'flex-1')}>
            ${preset.label}
          </button>
        `)}
      </div>
    </div>
  `;
}
