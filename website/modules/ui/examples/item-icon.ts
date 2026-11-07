import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  itemClass, itemActionsClass, itemContentClass, itemDescriptionClass,
  itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { ShieldAlertIcon } from '#lib/ui/lucide.ts';

export default function ItemIcon() {
  return html`
    <div class="flex w-full max-w-lg flex-col gap-6">
      <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
          ${ShieldAlertIcon()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Security Alert</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            New login detected from unknown device.
          </p>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
            Review
          </button>
        </div>
      </div>
    </div>
  `;
}
