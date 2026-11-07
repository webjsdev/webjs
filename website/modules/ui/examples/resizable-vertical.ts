import { html } from '@webjsdev/core';

export default function ResizableVertical() {
  return html`
    <ui-resizable-panel-group orientation="vertical" class="min-h-[200px] max-w-sm rounded-lg border">
      <ui-resizable-panel default-size="25">
        <div class="flex h-full items-center justify-center p-6">
          <span class="font-semibold">Header</span>
        </div>
      </ui-resizable-panel>
      <ui-resizable-handle></ui-resizable-handle>
      <ui-resizable-panel default-size="75">
        <div class="flex h-full items-center justify-center p-6">
          <span class="font-semibold">Content</span>
        </div>
      </ui-resizable-panel>
    </ui-resizable-panel-group>
  `;
}
