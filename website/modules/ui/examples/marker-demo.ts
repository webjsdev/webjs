import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { markerClass, markerContentClass, markerIconClass } from '#modules/ui/components/marker.ts';
import { spinner } from '#modules/ui/components/spinner.ts';
import { GitBranchIcon, SearchIcon } from '#lib/ui/lucide.ts';

export default function MarkerDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="marker" data-variant="default" class=${markerClass()}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${GitBranchIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Switched to a new branch</span>
      </div>
      <div data-slot="marker" data-variant="default" role="status" class=${markerClass()}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${spinner({ decorative: true })}
        </span>
        <span data-slot="marker-content" class=${cn(markerContentClass(), 'shimmer')}>Thinking...</span>
      </div>
      <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${markerContentClass()}>Conversation compacted</span>
      </div>
      <div data-slot="marker" data-variant="default" class=${markerClass()}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${SearchIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Explored 4 files</span>
      </div>
    </div>
  `;
}
