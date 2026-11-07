import { html } from '@webjsdev/core';
import { progressClass } from '#modules/ui/components/progress.ts';
import { sliderClass } from '#modules/ui/components/slider.ts';

// shadcn's demo keeps the bar and the slider in step through React state.
// In an app, set the bar's value from the slider's ui-value-change event
// (see the Controlled section); this preview shows both at the start value.
export default function ProgressControlled() {
  return html`
    <div class="flex w-full max-w-sm flex-col gap-4">
      <progress data-slot="progress" value="50" max="100" aria-label="Progress" class=${progressClass()}></progress>
      <ui-slider>
        <input type="range" min="0" max="100" step="1" value="50" aria-label="Value" class=${sliderClass()}>
      </ui-slider>
    </div>
  `;
}
