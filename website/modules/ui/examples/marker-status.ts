import { html } from '@webjsdev/core';
import { markerClass, markerContentClass, markerIconClass } from '#modules/ui/components/marker.ts';
import { spinner } from '#modules/ui/components/spinner.ts';

export default function MarkerStatusDemo() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-8 py-12">
      <div data-slot="marker" data-variant="default" role="status" class=${markerClass()}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${spinner({ decorative: true })}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Compacting conversation</span>
      </div>
      <div data-slot="marker" data-variant="separator" role="status" class=${markerClass({ variant: 'separator' })}>
        <span data-slot="marker-icon" aria-hidden="true" class=${markerIconClass()}>
          ${spinner({ decorative: true })}
        </span>
        <span data-slot="marker-content" class=${markerContentClass()}>Running tests</span>
      </div>
    </div>
  `;
}
