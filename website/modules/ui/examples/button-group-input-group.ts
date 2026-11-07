import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import {
  inputGroupClass, inputGroupAddonClass, inputGroupButtonClass, inputGroupInputClass,
} from '#modules/ui/components/input-group.ts';
import { AudioLinesIcon, PlusIcon } from '#lib/ui/lucide.ts';

export default function ButtonGroupInputGroup() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), '[--radius:9999rem]')}>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Add" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
          ${PlusIcon()}
        </button>
      </div>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <div data-slot="input-group" role="group" class=${inputGroupClass()}>
          <input data-slot="input-group-control" type="text" placeholder="Send a message..." aria-label="Message" class=${inputGroupInputClass()}>
          <div data-slot="input-group-addon" data-align="inline-end" class=${inputGroupAddonClass({ align: 'inline-end' })}>
            <ui-tooltip>
              <ui-tooltip-trigger>
                <button type="button" data-slot="button" data-size="icon-xs" data-active="false" aria-pressed="false" aria-label="Voice Mode" class=${cn(inputGroupButtonClass({ size: 'icon-xs' }), 'data-[active=true]:bg-orange-100 data-[active=true]:text-orange-700 dark:data-[active=true]:bg-orange-800 dark:data-[active=true]:text-orange-100')}>
                  ${AudioLinesIcon()}
                </button>
              </ui-tooltip-trigger>
              <ui-tooltip-content>Voice Mode</ui-tooltip-content>
            </ui-tooltip>
          </div>
        </div>
      </div>
    </div>
  `;
}
