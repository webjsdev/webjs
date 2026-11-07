import { html } from '@webjsdev/core';
import { markerClass, markerContentClass } from '#modules/ui/components/marker.ts';

export default function MarkerSeparatorDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${markerContentClass()}>Today</span>
      </div>
      <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${markerContentClass()}>Worked for 42s</span>
      </div>
      <div data-slot="marker" data-variant="separator" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-content" class=${markerContentClass()}>Conversation compacted</span>
      </div>
    </div>
  `;
}
