import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';

// Replay without script: the checkbox swaps which of two copies is shown, and
// an element going from display:none to shown starts its animation over.
export default function ShimmerOnce() {
  return html`
    <div class="flex flex-col items-center gap-4">
      <input type="checkbox" id="shimmer-once-replay" class="peer sr-only">
      <p class="shimmer text-sm text-muted-foreground shimmer-duration-1100 shimmer-once peer-checked:hidden">Generating response&hellip;</p>
      <p class="hidden shimmer text-sm text-muted-foreground shimmer-duration-1100 shimmer-once peer-checked:block">Generating response&hellip;</p>
      <label for="shimmer-once-replay" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50')}>Replay</label>
    </div>
  `;
}
