import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  avatarClass, avatarImageClass, avatarFallbackClass, avatarBadgeClass,
} from '#modules/ui/components/avatar.ts';
import { PlusIcon } from '#lib/ui/lucide.ts';

export default function AvatarBadgeIconExample() {
  return html`
    <span data-slot="avatar" data-size="default" class=${cn(avatarClass(), 'grayscale')}>
      <img data-slot="avatar-image" src="https://github.com/pranathip.png" alt="@pranathip" class=${avatarImageClass()}>
      <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>PP</span>
      <span data-slot="avatar-badge" class=${avatarBadgeClass()}>
        ${PlusIcon()}
      </span>
    </span>
  `;
}
