import { html } from '@webjsdev/core';
import { BookmarkIcon } from '#lib/ui/lucide.ts';

export default function ToggleDemo() {
  return html`
    <ui-toggle aria-label="Toggle bookmark" size="sm" variant="outline">
      ${BookmarkIcon('group-data-[state=on]/toggle:fill-foreground')}
      Bookmark
    </ui-toggle>
  `;
}
