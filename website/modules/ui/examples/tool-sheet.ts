import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  sheetHeaderClass, sheetTitleClass, sheetDescriptionClass,
} from '#modules/ui/components/sheet.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, FileTextIcon } from '#lib/ui/lucide.ts';

const PACKAGE_JSON = `{
  "name": "acme-chat",
  "private": true,
  "dependencies": {
    "@ai-sdk/react": "^4.0.0",
    "ai": "^7.0.0",
    "next": "^16.3.0"
  }
}`;

const path = 'package.json';

// The conversation once the reply has finished. The read is a trace line
// wrapped in the sheet's trigger, so the long output opens beside the chat
// instead of expanding inside it.
export default function ToolSheet() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>Which AI SDK version does this app use?</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <div data-slot="trace" class=${traceClass()}>
            <ui-sheet>
              <ui-sheet-trigger>
                <button type="button" class="flex w-fit max-w-full min-w-0 text-start outline-none">
                  <span data-slot="trace-line" class=${traceLineClass()}>
                    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${FileTextIcon()}</span>
                    <span data-slot="trace-title" class=${traceTitleClass()}>Read ${path}</span>
                    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${ChevronRightIcon()}</span>
                  </span>
                </button>
              </ui-sheet-trigger>
              <ui-sheet-content side="right">
                <div data-slot="sheet-header" class=${sheetHeaderClass()}>
                  <h2 data-slot="sheet-title" class=${cn(sheetTitleClass(), 'font-mono')}>${path}</h2>
                  <p data-slot="sheet-description" class=${sheetDescriptionClass()}>${PACKAGE_JSON.split('\n').length} lines</p>
                </div>
                <div data-slot="code-block" data-variant="default" class=${cn(codeBlockClass(), 'mx-6 mb-6 w-auto')}>
                  <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(PACKAGE_JSON)}</code></pre>
                </div>
              </ui-sheet-content>
            </ui-sheet>
          </div>
          <p>It uses ai 7 with @ai-sdk/react 4.</p>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Reset
      </button>
    </div>
  `;
}
