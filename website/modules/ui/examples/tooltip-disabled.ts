import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function TooltipDisabled() {
  return html`
    <ui-tooltip>
      <ui-tooltip-trigger>
        <span class="inline-block w-fit">
          <button type="button" data-slot="button" data-variant="outline" data-size="default" disabled class=${buttonClass({ variant: 'outline' })}>
            Disabled
          </button>
        </span>
      </ui-tooltip-trigger>
      <ui-tooltip-content>
        <p>This feature is currently unavailable</p>
      </ui-tooltip-content>
    </ui-tooltip>
  `;
}
