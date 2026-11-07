import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  avatarClass, avatarImageClass, avatarFallbackClass, avatarBadgeClass,
} from '#modules/ui/components/avatar.ts';

export default function AvatarWithBadge() {
  return html`
    <span data-slot="avatar" data-size="default" class=${avatarClass()}>
      <img data-slot="avatar-image" src="https://github.com/shadcn.png" alt="@shadcn" class=${avatarImageClass()}>
      <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>CN</span>
      <span data-slot="avatar-badge" class=${cn(avatarBadgeClass(), 'bg-green-600 dark:bg-green-800')}></span>
    </span>
  `;
}
