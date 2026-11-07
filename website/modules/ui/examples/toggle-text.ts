import { html } from '@webjsdev/core';
import { ItalicIcon } from '#lib/ui/lucide.ts';

export default function ToggleText() {
  return html`
    <ui-toggle aria-label="Toggle italic">
      ${ItalicIcon()}
      Italic
    </ui-toggle>
  `;
}
