import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  itemClass, itemContentClass, itemDescriptionClass, itemMediaClass, itemTitleClass,
} from '#modules/ui/components/item.ts';
import { ChevronDownIcon } from '#lib/ui/lucide.ts';

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

export default function ItemDropdown() {
  return html`
    <ui-dropdown-menu>
      <ui-dropdown-menu-trigger>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
          Select ${ChevronDownIcon()}
        </button>
      </ui-dropdown-menu-trigger>
      <ui-dropdown-menu-content class="w-48" align="end">
        <ui-dropdown-menu-group>
          ${people.map((person) => html`
            <ui-dropdown-menu-item>
              <div data-slot="item" data-variant="default" data-size="xs" class=${cn(itemClass({ size: 'xs' }), 'w-full p-2')}>
                <div data-slot="item-media" data-variant="default" class=${itemMediaClass()}>
                  <span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'size-[--spacing(6.5)]')}>
                    <img data-slot="avatar-image" src=${person.avatar} alt="" class=${cn(avatarImageClass(), 'grayscale')}>
                    <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>${person.username.charAt(0)}</span>
                  </span>
                </div>
                <div data-slot="item-content" class=${cn(itemContentClass(), 'gap-0')}>
                  <div data-slot="item-title" class=${itemTitleClass()}>${person.username}</div>
                  <p data-slot="item-description" class=${cn(itemDescriptionClass(), 'leading-none')}>${person.email}</p>
                </div>
              </div>
            </ui-dropdown-menu-item>
          `)}
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
