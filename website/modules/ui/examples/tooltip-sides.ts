import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

const sides = ['left', 'top', 'bottom', 'right'] as const;

export default function TooltipSides() {
  return html`
    <div class="flex flex-wrap gap-2">
      ${sides.map((side) => html`
        <ui-tooltip>
          <ui-tooltip-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'w-fit capitalize')}>
              ${side}
            </button>
          </ui-tooltip-trigger>
          <ui-tooltip-content side=${side}>
            <p>Add to library</p>
          </ui-tooltip-content>
        </ui-tooltip>
      `)}
    </div>
  `;
}
