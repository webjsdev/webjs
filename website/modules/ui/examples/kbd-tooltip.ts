import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import { kbdClass, kbdGroupClass } from '#modules/ui/components/kbd.ts';

// Each button sits inside its <ui-tooltip>, so the group's direct-child
// selectors land on the tooltip hosts; the buttons square their own joined
// corners instead.
export default function KbdTooltip() {
  return html`
    <div class="flex flex-wrap gap-4">
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <ui-tooltip>
          <ui-tooltip-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'rounded-e-none')}>Save</button>
          </ui-tooltip-trigger>
          <ui-tooltip-content>
            Save Changes <kbd data-slot="kbd" class=${kbdClass()}>S</kbd>
          </ui-tooltip-content>
        </ui-tooltip>
        <ui-tooltip>
          <ui-tooltip-trigger>
            <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${cn(buttonClass({ variant: 'outline' }), 'rounded-s-none border-s-0')}>Print</button>
          </ui-tooltip-trigger>
          <ui-tooltip-content>
            Print Document${' '}
            <kbd data-slot="kbd-group" role="img" aria-label="Control plus P" class=${kbdGroupClass()}>
              <kbd data-slot="kbd" class=${kbdClass()}>Ctrl</kbd>
              <kbd data-slot="kbd" class=${kbdClass()}>P</kbd>
            </kbd>
          </ui-tooltip-content>
        </ui-tooltip>
      </div>
    </div>
  `;
}
