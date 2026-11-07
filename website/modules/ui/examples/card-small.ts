import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass,
  cardContentClass, cardFooterClass,
} from '#modules/ui/components/card.ts';

export default function CardSmall() {
  return html`
    <div data-slot="card" data-size="sm" class=${cn(cardClass({ size: 'sm' }), 'mx-auto w-full max-w-sm')}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Small Card</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>
          This card uses the small size variant.
        </div>
      </div>
      <div data-slot="card-content" class=${cardContentClass()}>
        <p>
          The card component supports a size prop that can be set to
          &quot;sm&quot; for a more compact appearance.
        </p>
      </div>
      <div data-slot="card-footer" class=${cardFooterClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'w-full')}>
          Action
        </button>
      </div>
    </div>
  `;
}
