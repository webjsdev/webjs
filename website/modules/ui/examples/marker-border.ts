import { html } from '@webjsdev/core';
import { markerClass, markerContentClass, markerIconClass } from '#modules/ui/components/marker.ts';
import { FileTextIcon, GitBranchIcon, SearchIcon } from '#lib/ui/lucide.ts';

export default function MarkerBorderDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-3 py-12">
      <div data-slot="marker" data-variant="border" class=${markerClass({ variant: 'border' })}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${GitBranchIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Switched to release-candidate</span>
      </div>
      <div data-slot="marker" data-variant="border" class=${markerClass({ variant: 'border' })}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${SearchIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Reviewed 8 related files</span>
      </div>
      <div data-slot="marker" data-variant="border" class=${markerClass({ variant: 'border' })}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${FileTextIcon()}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Opened implementation notes</span>
      </div>
    </div>
  `;
}
