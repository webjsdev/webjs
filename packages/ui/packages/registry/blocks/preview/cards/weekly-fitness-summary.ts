/**
 * The preview block's weekly fitness card: the workout load per day as a row
 * of filled bars. A fragment helper, rendered by the server. Installed by
 * `npx @webjsdev/ui add preview` at
 * `components/preview/weekly-fitness-summary.ts`. Ported from shadcn/ui's
 * preview block.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

const FITNESS_WEEKLY_LOAD = [
  { day: 'M', load: 84 },
  { day: 'T', load: 52 },
  { day: 'W', load: 73 },
  { day: 'T', load: 66 },
  { day: 'F', load: 91 },
  { day: 'S', load: 48 },
  { day: 'S', load: 61 },
];

export function weeklyFitnessSummary() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Weekly Fitness Summary</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Calories and workout load by day</div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div class="grid grid-cols-7 gap-1.5">
          ${FITNESS_WEEKLY_LOAD.map((day) => html`
            <div class="rounded-md p-1.5 text-center ring ring-border">
              <div class="text-sm text-muted-foreground">${day.day}</div>
              <div class="relative mt-1 h-16 overflow-hidden rounded-sm bg-muted">
                <div class="absolute inset-x-0 bottom-0 rounded-sm bg-chart-3" style=${`height: ${day.load}%`}></div>
              </div>
            </div>
          `)}
        </div>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="default" data-size="default" class=${cn(buttonClass(), 'w-full')}>View details</button>
      </div>
    </div>
  `;
}
