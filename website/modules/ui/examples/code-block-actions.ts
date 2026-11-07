import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import { DownloadIcon, TerminalIcon, WrapTextIcon } from '#lib/ui/lucide.ts';

const output = `$ pnpm lint
apps/web/components/message-list.tsx
  18:22  error  'messages' is possibly 'undefined'. Add a guard before calling map  @typescript-eslint/no-unsafe-call
  42:7   warning  React Hook React.useEffect has a missing dependency: 'scrollToBottom'  react-hooks/exhaustive-deps

✖ 2 problems (1 error, 1 warning)`;

// The wrap toggle starts pressed, so the content carries data-wrap. A
// component that owns the toggle flips aria-pressed and data-wrap together.
export default function CodeBlockActions() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>
            ${TerminalIcon()}
            Terminal
          </div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <button
              type="button"
              data-slot="button"
              data-variant="ghost"
              data-size="icon-xs"
              aria-label="Wrap lines"
              aria-pressed="true"
              class=${cn(buttonClass({ variant: 'ghost', size: 'icon-xs' }), 'aria-pressed:text-foreground')}
            >
              ${WrapTextIcon()}
            </button>
            <button
              type="button"
              data-slot="button"
              data-variant="ghost"
              data-size="icon-xs"
              aria-label="Download"
              class=${buttonClass({ variant: 'ghost', size: 'icon-xs' })}
            >
              ${DownloadIcon()}
            </button>
            <ui-code-block-copy-button value=${output}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output}</code></pre>
      </div>
    </div>
  `;
}
