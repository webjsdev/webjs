import { html } from '@webjsdev/core';
import {
  itemClass, itemContentClass, itemDescriptionClass, itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { InboxIcon } from '#lib/ui/lucide.ts';

export default function ItemSizeDemo() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-6">
      <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
          ${InboxIcon()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Default Size</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            The standard size for most use cases.
          </p>
        </div>
      </div>
      <div data-slot="item" data-variant="outline" data-size="sm" class=${itemClass({ variant: 'outline', size: 'sm' })}>
        <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
          ${InboxIcon()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Small Size</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>A compact size for dense layouts.</p>
        </div>
      </div>
      <div data-slot="item" data-variant="outline" data-size="xs" class=${itemClass({ variant: 'outline', size: 'xs' })}>
        <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
          ${InboxIcon()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Extra Small Size</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>The most compact size available.</p>
        </div>
      </div>
    </div>
  `;
}
