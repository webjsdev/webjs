import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { markerClass, markerContentClass, markerIconClass } from '#modules/ui/components/marker.ts';
import { BookOpenCheck, GitBranchIcon, SearchIcon } from '#lib/ui/lucide.ts';

export default function MarkerIconDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-12 py-12">
      <div data-slot="marker" data-variant="default" class=${markerClass()}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${GitBranchIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Switched to a new branch</span>
      </div>
      <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${SearchIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Explored 4 files</span>
      </div>
      <div data-slot="marker" data-variant="default" class=${cn(markerClass(), 'flex-col')}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${BookOpenCheck()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Syncing completed</span>
      </div>
    </div>
  `;
}
