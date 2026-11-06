import { html } from '@webjsdev/core';
import { checkboxClass } from '#modules/ui/components/checkbox.ts';
import { labelClass } from '#modules/ui/components/label.ts';

export default function LabelDemo() {
  return html`
    <div class="flex gap-2">
      <input type="checkbox" data-slot="checkbox" id="terms" class=${checkboxClass()}>
      <label data-slot="label" for="terms" class=${labelClass()}>Accept terms and conditions</label>
    </div>
  `;
}
