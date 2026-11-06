import { html } from '@webjsdev/core';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  itemClass, itemActionsClass, itemContentClass, itemDescriptionClass,
  itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { BadgeCheckIcon, ChevronRightIcon } from '#lib/ui/lucide.ts';

export default function ItemDemo() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-6">
      <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Basic Item</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            A simple item with title and description.
          </p>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${buttonClass({ variant: 'outline', size: 'sm' })}>
            Action
          </button>
        </div>
      </div>
      <a href="#" data-slot="item" data-variant="outline" data-size="sm" class=${itemClass({ variant: 'outline', size: 'sm' })}>
        <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
          ${BadgeCheckIcon('size-5')}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Your profile has been verified.</div>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          ${ChevronRightIcon('size-4')}
        </div>
      </a>
    </div>
  `;
}
