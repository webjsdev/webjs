import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { markerClass, markerContentClass, markerIconClass } from '#modules/ui/components/marker.ts';
import { GitBranchIcon, RotateCcwIcon } from '#lib/ui/lucide.ts';

export default function MarkerLinkButtonDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <a href="#links-and-buttons" data-slot="marker" data-variant="default" class=${markerClass()}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${GitBranchIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>View the pull request</span>
      </a>
      <button type="button" data-slot="marker" data-variant="default" class=${cn(markerClass(), 'transition-colors hover:text-foreground')}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${RotateCcwIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Revert this change</span>
      </button>
    </div>
  `;
}
