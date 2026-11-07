import { html } from '@webjsdev/core';

export default function ToggleDisabled() {
  return html`
    <div class="flex flex-wrap items-center gap-2">
      <ui-toggle aria-label="Toggle disabled" disabled>
        Disabled
      </ui-toggle>
      <ui-toggle variant="outline" aria-label="Toggle disabled outline" disabled>
        Disabled
      </ui-toggle>
    </div>
  `;
}
