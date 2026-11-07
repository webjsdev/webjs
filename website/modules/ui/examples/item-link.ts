import { html } from '@webjsdev/core';
import {
  itemClass, itemActionsClass, itemContentClass, itemDescriptionClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { ChevronRightIcon, ExternalLinkIcon } from '#lib/ui/lucide.ts';

// A link that is an item is an <a> carrying the item's classes. There is no
// wrapper and no asChild.
export default function ItemLink() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-4">
      <a href="#" data-slot="item" data-variant="default" data-size="default" class=${itemClass()}>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Visit our documentation</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            Learn how to get started with our components.
          </p>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          ${ChevronRightIcon('size-4')}
        </div>
      </a>
      <a href="#" target="_blank" rel="noopener noreferrer" data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>External resource</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            Opens in a new tab with security attributes.
          </p>
        </div>
        <div data-slot="item-actions" class=${itemActionsClass()}>
          ${ExternalLinkIcon('size-4')}
        </div>
      </a>
    </div>
  `;
}
