import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { radioGroupClass, radioClass } from '#modules/ui/components/radio-group.ts';
import { labelClass } from '#modules/ui/components/label.ts';

export default function RadioGroupDemo() {
  return html`
    <div role="radiogroup" aria-label="Density" data-slot="radio-group" class=${cn(radioGroupClass(), 'w-fit')}>
      <div class="flex items-center gap-3">
        <input type="radio" data-slot="radio" name="radio-group-demo" value="default" id="r1" class=${radioClass()}>
        <label data-slot="label" for="r1" class=${labelClass()}>Default</label>
      </div>
      <div class="flex items-center gap-3">
        <input type="radio" data-slot="radio" name="radio-group-demo" value="comfortable" id="r2" checked class=${radioClass()}>
        <label data-slot="label" for="r2" class=${labelClass()}>Comfortable</label>
      </div>
      <div class="flex items-center gap-3">
        <input type="radio" data-slot="radio" name="radio-group-demo" value="compact" id="r3" class=${radioClass()}>
        <label data-slot="label" for="r3" class=${labelClass()}>Compact</label>
      </div>
    </div>
  `;
}
