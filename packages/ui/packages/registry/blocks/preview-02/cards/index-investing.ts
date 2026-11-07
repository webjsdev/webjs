/**
 * The preview-02 "Dollar-Cost Averaging" card: a heading over a paragraph
 * with an inline link. A fragment helper. Installed at
 * `components/preview-02/index-investing.ts`. Ported from shadcn/ui's
 * preview-02.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';

export function indexInvesting() {
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Dollar-Cost Averaging</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>A strategy for building wealth over time.</div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <div data-slot="card-description" class=${cn(cardDescriptionClass(), 'mt-3 text-sm leading-relaxed style-sera:mt-0')}>
          <a href="#" class="underline underline-offset-4 hover:text-primary">Over time</a>, this smooths out the average cost of your investments. When prices drop, your fixed amount buys more shares. When prices rise, you buy fewer. The result is a lower average cost per share compared to lump-sum investing during volatile periods.
        </div>
      </div>
    </div>
  `;
}
