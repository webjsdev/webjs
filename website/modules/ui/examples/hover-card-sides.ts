import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

const HOVER_CARD_SIDES = ['left', 'top', 'bottom', 'right'] as const;

export default function HoverCardSides() {
  return html`
    <div class="flex flex-wrap justify-center gap-2">
      ${HOVER_CARD_SIDES.map((side) => html`
        <ui-hover-card open-delay="100" close-delay="100">
          <ui-hover-card-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'capitalize')}>${side}</button>
          </ui-hover-card-trigger>
          <ui-hover-card-content side=${side}>
            <div class="flex flex-col gap-1">
              <h4 data-slot="hover-card-title" class="font-medium">Hover Card</h4>
              <p>This hover card appears on the ${side} side of the trigger.</p>
            </div>
          </ui-hover-card-content>
        </ui-hover-card>
      `)}
    </div>
  `;
}
