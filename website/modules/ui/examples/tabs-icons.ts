import { html } from '@webjsdev/core';
import { AppWindowIcon, CodeIcon } from '#lib/ui/lucide.ts';

export default function TabsIcons() {
  return html`
    <ui-tabs value="preview">
      <ui-tabs-list>
        <ui-tabs-trigger value="preview">
          ${AppWindowIcon()}
          Preview
        </ui-tabs-trigger>
        <ui-tabs-trigger value="code">
          ${CodeIcon()}
          Code
        </ui-tabs-trigger>
      </ui-tabs-list>
    </ui-tabs>
  `;
}
