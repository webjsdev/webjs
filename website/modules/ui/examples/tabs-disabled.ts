import { html } from '@webjsdev/core';

export default function TabsDisabled() {
  return html`
    <ui-tabs value="home">
      <ui-tabs-list>
        <ui-tabs-trigger value="home">Home</ui-tabs-trigger>
        <ui-tabs-trigger value="settings" disabled>
          Disabled
        </ui-tabs-trigger>
      </ui-tabs-list>
    </ui-tabs>
  `;
}
