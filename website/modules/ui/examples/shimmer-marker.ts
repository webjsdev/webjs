import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { markerClass, markerContentClass, markerIconClass } from '#modules/ui/components/marker.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function ShimmerMarker() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-4">
      <div data-slot="marker" data-variant="default" role="status" class=${markerClass()}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${spinner({ decorative: true })}
        </span>
        <span data-slot="marker-content" class=${cn(markerContentClass(), 'shimmer')}>Thinking...</span>
      </div>
      <div data-slot="marker" data-variant="separator" role="status" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${cn(markerContentClass(), 'shimmer')}>Reading 4 files</span>
      </div>
    </div>
  `;
}
