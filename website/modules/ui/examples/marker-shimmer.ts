import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { markerClass, markerContentClass } from '#modules/ui/components/marker.ts';

export default function MarkerShimmerDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="marker" data-variant="default" role="status" class=${markerClass()}>
        <span data-slot="marker-content" class=${cn(markerContentClass(), 'shimmer')}>Thinking...</span>
      </div>
      <div data-slot="marker" data-variant="separator" role="status" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${cn(markerContentClass(), 'shimmer')}>Reading 4 files</span>
      </div>
    </div>
  `;
}
