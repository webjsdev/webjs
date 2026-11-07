import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  itemClass, itemActionsClass, itemContentClass, itemDescriptionClass,
  itemGroupClass, itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { PlusIcon } from '#lib/ui/lucide.ts';

const people = [
  {
    username: 'vivek',
    avatar: '/public/avatars/vivek.jpg',
    email: 'vivek@example.com',
  },
  {
    username: 'maxleiter',
    avatar: 'https://github.com/maxleiter.png',
    email: 'maxleiter@vercel.com',
  },
  {
    username: 'evilrabbit',
    avatar: 'https://github.com/evilrabbit.png',
    email: 'evilrabbit@vercel.com',
  },
];

export default function ItemGroupExample() {
  return html`
    <div role="list" data-slot="item-group" class=${cn(itemGroupClass(), 'max-w-sm')}>
      ${people.map((person) => html`
        <div role="listitem" data-slot="item" data-variant="outline" data-size="default" class=${itemClass({ variant: 'outline' })}>
          <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
            <span data-slot="avatar" data-size="default" class=${avatarClass()}>
              <img data-slot="avatar-image" src=${person.avatar} alt="" class=${cn(avatarImageClass(), 'grayscale')}>
              <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>${person.username.charAt(0)}</span>
            </span>
          </div>
          <div data-slot="item-content" class=${cn(itemContentClass(), 'gap-1')}>
            <div data-slot="item-title" class=${itemTitleClass()}>${person.username}</div>
            <p data-slot="item-description" class=${itemDescriptionClass()}>${person.email}</p>
          </div>
          <div data-slot="item-actions" class=${itemActionsClass()}>
            <button type="button" data-slot="button" data-variant="ghost" data-size="icon" aria-label=${`Add ${person.username}`} class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'rounded-full')}>
              ${PlusIcon()}
            </button>
          </div>
        </div>
      `)}
    </div>
  `;
}
