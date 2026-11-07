import { html } from '@webjsdev/core';
import { badgeClass } from '#modules/ui/components/badge.ts';
import { BadgeCheck, BookmarkIcon } from '#lib/ui/lucide.ts';

export default function BadgeWithIconLeft() {
  return html`
    <div class="flex flex-wrap gap-2">
      <span data-slot="badge" data-variant="secondary" class=${badgeClass({ variant: 'secondary' })}>
        ${BadgeCheck()}
        Verified
      </span>
      <span data-slot="badge" data-variant="outline" class=${badgeClass({ variant: 'outline' })}>
        Bookmark
        ${BookmarkIcon()}
      </span>
    </div>
  `;
}
