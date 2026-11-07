import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { badgeClass } from '#modules/ui/components/badge.ts';

export default function BadgeCustomColors() {
  return html`
    <div class="flex flex-wrap gap-2">
      <span data-slot="badge" data-variant="default" class=${cn(badgeClass(), 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300')}>
        Blue
      </span>
      <span data-slot="badge" data-variant="default" class=${cn(badgeClass(), 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300')}>
        Green
      </span>
      <span data-slot="badge" data-variant="default" class=${cn(badgeClass(), 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300')}>
        Sky
      </span>
      <span data-slot="badge" data-variant="default" class=${cn(badgeClass(), 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300')}>
        Purple
      </span>
      <span data-slot="badge" data-variant="default" class=${cn(badgeClass(), 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300')}>
        Red
      </span>
    </div>
  `;
}
