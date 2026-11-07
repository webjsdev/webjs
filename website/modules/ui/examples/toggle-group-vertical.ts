import { html } from '@webjsdev/core';
import { BoldIcon, ItalicIcon, UnderlineIcon } from '#lib/ui/lucide.ts';

export default function ToggleGroupVertical() {
  return html`
    <ui-toggle-group type="multiple" orientation="vertical" spacing="1" value="bold,italic">
      <ui-toggle-group-item value="bold" aria-label="Toggle bold">
        ${BoldIcon()}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="italic" aria-label="Toggle italic">
        ${ItalicIcon()}
      </ui-toggle-group-item>
      <ui-toggle-group-item value="underline" aria-label="Toggle underline">
        ${UnderlineIcon()}
      </ui-toggle-group-item>
    </ui-toggle-group>
  `;
}
