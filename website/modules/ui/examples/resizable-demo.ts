import { html } from '@webjsdev/core';

export default function ResizableDemo() {
  return html`
    <ui-resizable-panel-group orientation="horizontal" class="max-w-sm rounded-lg border">
      <ui-resizable-panel default-size="50">
        <div class="flex h-[200px] items-center justify-center p-6">
          <span class="font-semibold">One</span>
        </div>
      </ui-resizable-panel>
      <ui-resizable-handle with-handle></ui-resizable-handle>
      <ui-resizable-panel default-size="50">
        <ui-resizable-panel-group orientation="vertical">
          <ui-resizable-panel default-size="25">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">Two</span>
            </div>
          </ui-resizable-panel>
          <ui-resizable-handle with-handle></ui-resizable-handle>
          <ui-resizable-panel default-size="75">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">Three</span>
            </div>
          </ui-resizable-panel>
        </ui-resizable-panel-group>
      </ui-resizable-panel>
    </ui-resizable-panel-group>
  `;
}
