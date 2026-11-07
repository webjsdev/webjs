import { html } from '@webjsdev/core';

export default function ToggleSizes() {
  return html`
    <div class="flex flex-wrap items-center gap-2">
      <ui-toggle variant="outline" aria-label="Toggle small" size="sm">
        Small
      </ui-toggle>
      <ui-toggle variant="outline" aria-label="Toggle default" size="default">
        Default
      </ui-toggle>
      <ui-toggle variant="outline" aria-label="Toggle large" size="lg">
        Large
      </ui-toggle>
    </div>
  `;
}
