import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';

export default function TooltipDemo() {
  return html`
    <ui-tooltip>
      <ui-tooltip-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Hover</button>
      </ui-tooltip-trigger>
      <ui-tooltip-content>
        <p>Add to library</p>
      </ui-tooltip-content>
    </ui-tooltip>
  `;
}
