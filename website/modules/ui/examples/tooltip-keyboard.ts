import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import { kbdClass } from '#modules/ui/components/kbd.ts';
import { SaveIcon } from '#lib/ui/lucide.ts';

export default function TooltipKeyboard() {
  return html`
    <ui-tooltip>
      <ui-tooltip-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon-sm" aria-label="Save Changes" class=${buttonClass({ variant: 'outline', size: 'icon-sm' })}>
          ${SaveIcon()}
        </button>
      </ui-tooltip-trigger>
      <ui-tooltip-content>
        Save Changes <kbd data-slot="kbd" class=${kbdClass()}>S</kbd>
      </ui-tooltip-content>
    </ui-tooltip>
  `;
}
