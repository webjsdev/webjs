import { html } from '@webjsdev/core';
import {
  itemClass, itemContentClass, itemDescriptionClass, itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { InboxIcon } from '#lib/ui/lucide.ts';

export default function ItemVariant() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-6">
      <div data-slot="item" data-variant="default" data-size="default" class=${itemClass()}>
        <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
          ${InboxIcon()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Default Variant</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            Transparent background with no border.
          </p>
        </div>
      </div>
      <div data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
        <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
          ${InboxIcon()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Outline Variant</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            Outlined style with a visible border.
          </p>
        </div>
      </div>
      <div data-slot="item" data-variant="muted" data-size="default" class=${itemClass({ variant: 'muted' })}>
        <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>
          ${InboxIcon()}
        </div>
        <div data-slot="item-content" class=${itemContentClass()}>
          <div data-slot="item-title" class=${itemTitleClass()}>Muted Variant</div>
          <p data-slot="item-description" class=${itemDescriptionClass()}>
            Muted background for secondary content.
          </p>
        </div>
      </div>
    </div>
  `;
}
