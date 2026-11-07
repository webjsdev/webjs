import { html } from '@webjsdev/core';
import { avatarClass, avatarImageClass, avatarFallbackClass } from '#modules/ui/components/avatar.ts';

// The size rides the data-size attribute, which the styles key on.
export default function AvatarSizeExample() {
  return html`
    <div class="flex flex-wrap items-center gap-2 grayscale">
      <span data-slot="avatar" data-size="sm" class=${avatarClass({ size: 'sm' })}>
        <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="@vivek" class=${avatarImageClass()}>
        <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
      </span>
      <span data-slot="avatar" data-size="default" class=${avatarClass()}>
        <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="@vivek" class=${avatarImageClass()}>
        <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
      </span>
      <span data-slot="avatar" data-size="lg" class=${avatarClass({ size: 'lg' })}>
        <img data-slot="avatar-image" src="/public/avatars/vivek.jpg" alt="@vivek" class=${avatarImageClass()}>
        <span data-slot="avatar-fallback" class=${avatarFallbackClass()}>VK</span>
      </span>
    </div>
  `;
}
