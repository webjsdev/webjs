import { html } from '@webjsdev/core';

export default function ToggleGroupOutline() {
  return html`
    <ui-toggle-group variant="outline" type="single" value="all">
      <ui-toggle-group-item value="all" aria-label="Toggle all">
        All
      </ui-toggle-group-item>
      <ui-toggle-group-item value="missed" aria-label="Toggle missed">
        Missed
      </ui-toggle-group-item>
    </ui-toggle-group>
  `;
}
