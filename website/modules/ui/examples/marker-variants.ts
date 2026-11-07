import { html } from '@webjsdev/core';
import { markerClass, markerContentClass } from '#modules/ui/components/marker.ts';

export default function MarkerVariantsDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="marker" data-variant="default" class=${markerClass()}>
        <span data-slot="marker-content" class=${markerContentClass()}>A default marker for inline notes.</span>
      </div>
      <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${markerContentClass()}>A separator marker</span>
      </div>
      <div data-slot="marker" data-variant="border" class=${markerClass({ variant: 'border' })}>
        <span data-slot="marker-content" class=${markerContentClass()}>A border marker for row boundaries.</span>
      </div>
    </div>
  `;
}
