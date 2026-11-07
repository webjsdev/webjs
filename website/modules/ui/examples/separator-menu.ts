import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { separatorClass } from '#modules/ui/components/separator.ts';

export default function SeparatorMenu() {
  return html`
    <div class="flex items-center gap-2 text-sm md:gap-4">
      <div class="flex flex-col gap-1">
        <span class="font-medium">Settings</span>
        <span class="text-xs text-muted-foreground">
          Manage preferences
        </span>
      </div>
      <div role="none" data-slot="separator" data-orientation="vertical" class=${separatorClass({ orientation: 'vertical' })}></div>
      <div class="flex flex-col gap-1">
        <span class="font-medium">Account</span>
        <span class="text-xs text-muted-foreground">
          Profile &amp; security
        </span>
      </div>
      <div role="none" data-slot="separator" data-orientation="vertical" class=${cn(separatorClass({ orientation: 'vertical' }), 'hidden md:block')}></div>
      <div class="hidden flex-col gap-1 md:flex">
        <span class="font-medium">Help</span>
        <span class="text-xs text-muted-foreground">Support &amp; docs</span>
      </div>
    </div>
  `;
}
