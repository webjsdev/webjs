import { html } from '@webjsdev/core';

export default function TabsVertical() {
  return html`
    <ui-tabs value="account" orientation="vertical">
      <ui-tabs-list>
        <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
        <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
        <ui-tabs-trigger value="notifications">Notifications</ui-tabs-trigger>
      </ui-tabs-list>
    </ui-tabs>
  `;
}
