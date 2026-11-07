import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';

const logs = Array.from(
  { length: 40 },
  (_, index) =>
    `[${String(index + 1).padStart(2, '0')}] GET /api/chat 200 in ${12 + ((index * 7) % 40)}ms`,
).join('\n');

export default function CodeBlockHeight() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>Logs</div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${logs}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-48 scroll-fade-y')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${logs}</code></pre>
      </div>
    </div>
  `;
}
