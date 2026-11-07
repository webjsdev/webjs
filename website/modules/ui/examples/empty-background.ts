import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  emptyClass, emptyHeaderClass, emptyMediaClass, emptyTitleClass,
  emptyDescriptionClass, emptyContentClass,
} from '#modules/ui/components/empty.ts';
import { IconBell } from '#lib/ui/tabler.ts';
import { RefreshCcwIcon } from '#lib/ui/lucide.ts';

export default function EmptyMuted() {
  return html`
    <div data-slot="empty" class=${cn(emptyClass(), 'h-full bg-muted/30')}>
      <div data-slot="empty-header" class=${emptyHeaderClass()}>
        <div data-slot="empty-icon" data-variant="icon" class=${emptyMediaClass({ variant: 'icon' })}>
          ${IconBell()}
        </div>
        <div data-slot="empty-title" class=${emptyTitleClass()}>No Notifications</div>
        <div data-slot="empty-description" class=${cn(emptyDescriptionClass(), 'max-w-xs text-pretty')}>
          You&apos;re all caught up. New notifications will appear here.
        </div>
      </div>
      <div data-slot="empty-content" class=${emptyContentClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>
          ${RefreshCcwIcon()}
          Refresh
        </button>
      </div>
    </div>
  `;
}
