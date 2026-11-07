import { html } from '@webjsdev/core';

// A radio set is a labelled group of type="radio" items, and the element
// keeps one of them checked.
export default function MenubarRadio() {
  return html`
    <ui-menubar class="w-72">
      <ui-menubar-menu>
        <ui-menubar-trigger>Profiles</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group aria-label="Profiles">
            <ui-menubar-item type="radio" value="andy">Andy</ui-menubar-item>
            <ui-menubar-item type="radio" value="benoit" checked>Benoit</ui-menubar-item>
            <ui-menubar-item type="radio" value="luis">Luis</ui-menubar-item>
          </ui-menubar-group>
          <ui-menubar-separator></ui-menubar-separator>
          <ui-menubar-item inset>Edit...</ui-menubar-item>
          <ui-menubar-item inset>Add Profile...</ui-menubar-item>
        </ui-menubar-content>
      </ui-menubar-menu>
      <ui-menubar-menu>
        <ui-menubar-trigger>Theme</ui-menubar-trigger>
        <ui-menubar-content>
          <ui-menubar-group aria-label="Theme">
            <ui-menubar-item type="radio" value="light">Light</ui-menubar-item>
            <ui-menubar-item type="radio" value="dark">Dark</ui-menubar-item>
            <ui-menubar-item type="radio" value="system" checked>System</ui-menubar-item>
          </ui-menubar-group>
        </ui-menubar-content>
      </ui-menubar-menu>
    </ui-menubar>
  `;
}
