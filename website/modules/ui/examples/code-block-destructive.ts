import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';

const error = `TypeError: Cannot read properties of undefined (reading 'map')
    at MessageList (components/message-list.tsx:18:22)
    at renderWithHooks (react-dom.development.js:16305:18)`;

export default function CodeBlockDestructive() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="destructive" data-size="default" class=${codeBlockClass({ variant: 'destructive' })}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>Error</div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${error}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${error}</code></pre>
      </div>
    </div>
  `;
}
