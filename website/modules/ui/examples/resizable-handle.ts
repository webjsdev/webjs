import { html } from '@webjsdev/core';

export default function ResizableHandleDemo() {
  return html`
    <ui-resizable-panel-group orientation="horizontal" class="min-h-[200px] max-w-md rounded-lg border md:min-w-[450px]">
      <ui-resizable-panel default-size="25">
        <div class="flex h-full items-center justify-center p-6">
          <span class="font-semibold">Sidebar</span>
        </div>
      </ui-resizable-panel>
      <ui-resizable-handle with-handle></ui-resizable-handle>
      <ui-resizable-panel default-size="75">
        <div class="flex h-full items-center justify-center p-6">
          <span class="font-semibold">Content</span>
        </div>
      </ui-resizable-panel>
    </ui-resizable-panel-group>
  `;
}
