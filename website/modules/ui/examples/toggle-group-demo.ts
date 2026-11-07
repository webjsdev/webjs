import { html } from '@webjsdev/core';
import { Bold, Italic, Underline } from '#lib/ui/lucide.ts';

export default function ToggleGroupDemo() {
  return html`
    <ui-toggle-group variant="outline" type="multiple">
      <ui-toggle-group-item value="bold" aria-label="Toggle bold">
        ${Bold()}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="italic" aria-label="Toggle italic">
        ${Italic()}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="strikethrough" aria-label="Toggle strikethrough">
        ${Underline()}
      </ui-toggle-group-item>
    </ui-toggle-group>
  `;
}
