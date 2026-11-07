import { html } from '@webjsdev/core';
import { Bold, Italic, Underline } from '#lib/ui/lucide.ts';

// The group has no disabled attribute of its own, so each item carries one.
export default function ToggleGroupDisabled() {
  return html`
    <ui-toggle-group type="multiple">
      <ui-toggle-group-item value="bold" aria-label="Toggle bold" disabled>
        ${Bold()}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="italic" aria-label="Toggle italic" disabled>
        ${Italic()}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="strikethrough" aria-label="Toggle strikethrough" disabled>
        ${Underline()}
      </ui-toggle-group-item>
    </ui-toggle-group>
  `;
}
