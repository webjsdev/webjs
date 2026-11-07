import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  itemClass, itemContentClass, itemDescriptionClass, itemGroupClass,
  itemHeaderClass, itemTitleClass,
} from '#modules/ui/components/item.ts';

const models = [
  {
    name: 'v0-1.5-sm',
    description: 'Everyday tasks and UI generation.',
    image:
      'https://images.unsplash.com/photo-1650804068570-7fb2e3dbf888?q=80&w=640&auto=format&fit=crop',
    credit: 'Valeria Reverdo on Unsplash',
  },
  {
    name: 'v0-1.5-lg',
    description: 'Advanced thinking or reasoning.',
    image:
      'https://images.unsplash.com/photo-1610280777472-54133d004c8c?q=80&w=640&auto=format&fit=crop',
    credit: 'Michael Oeser on Unsplash',
  },
  {
    name: 'v0-2.0-mini',
    description: 'Open Source model for everyone.',
    image:
      'https://images.unsplash.com/photo-1602146057681-08560aee8cde?q=80&w=640&auto=format&fit=crop',
    credit: 'Cherry Laithang on Unsplash',
  },
];

export default function ItemHeaderDemo() {
  return html`
    <div class="flex w-full max-w-xl flex-col gap-6">
      <div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'grid grid-cols-3 gap-4')}>
        ${models.map((model) => html`
          <div role="listitem" data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
            <div data-slot="item-header" class=${itemHeaderClass()}>
              <img src=${model.image} alt=${model.name} width="128" height="128" class="aspect-square w-full rounded-sm object-cover">
            </div>
            <div data-slot="item-content" class=${itemContentClass()}>
              <div data-slot="item-title" class=${itemTitleClass()}>${model.name}</div>
              <p data-slot="item-description" class=${itemDescriptionClass()}>${model.description}</p>
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
}
