import { html } from '@webjsdev/core';

export default function TabsLine() {
  return html`
    <ui-tabs value="overview">
      <ui-tabs-list variant="underline">
        <ui-tabs-trigger value="overview">Overview</ui-tabs-trigger>
        <ui-tabs-trigger value="analytics">Analytics</ui-tabs-trigger>
        <ui-tabs-trigger value="reports">Reports</ui-tabs-trigger>
      </ui-tabs-list>
    </ui-tabs>
  `;
}
