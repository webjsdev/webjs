import { html } from '@webjsdev/core';
import { labelClass } from '#modules/ui/components/label.ts';

export default function SwitchDemo() {
  return html`
    <div class="flex items-center space-x-2">
      <ui-switch input-id="airplane-mode"></ui-switch>
      <label data-slot="label" for="airplane-mode" class=${labelClass()}>Airplane Mode</label>
    </div>
  `;
}
