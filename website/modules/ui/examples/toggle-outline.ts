import { html } from '@webjsdev/core';
import { BoldIcon, ItalicIcon } from '#lib/ui/lucide.ts';

export default function ToggleOutline() {
  return html`
    <div class="flex flex-wrap items-center gap-2">
      <ui-toggle variant="outline" aria-label="Toggle italic">
        ${ItalicIcon()}
        Italic
      </ui-toggle>
      <ui-toggle variant="outline" aria-label="Toggle bold">
        ${BoldIcon()}
        Bold
      </ui-toggle>
    </div>
  `;
}
