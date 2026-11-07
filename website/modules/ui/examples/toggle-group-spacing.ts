import { html } from '@webjsdev/core';

export default function ToggleGroupSpacing() {
  return html`
    <ui-toggle-group type="single" size="sm" value="top" variant="outline" spacing="2">
      <ui-toggle-group-item value="top" aria-label="Toggle top">
        Top
      </ui-toggle-group-item>
      <ui-toggle-group-item value="bottom" aria-label="Toggle bottom">
        Bottom
      </ui-toggle-group-item>
      <ui-toggle-group-item value="left" aria-label="Toggle left">
        Left
      </ui-toggle-group-item>
      <ui-toggle-group-item value="right" aria-label="Toggle right">
        Right
      </ui-toggle-group-item>
    </ui-toggle-group>
  `;
}
