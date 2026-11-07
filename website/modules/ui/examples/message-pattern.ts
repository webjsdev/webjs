import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { messageClass, messageContentClass, messageFooterClass } from '#modules/ui/components/message.ts';
import {
  CopyIcon, PencilIcon, RefreshCcwIcon, ThumbsDownIcon, ThumbsUpIcon,
} from '#lib/ui/lucide.ts';

const inlineCode = 'rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]';
const command = 'npx @webjsdev/ui add dialog';

// A ghost icon button with its label in a tooltip, as shadcn's MessageAction.
function MessageAction(label: string, icon: unknown) {
  return html`
    <ui-tooltip>
      <ui-tooltip-trigger>
        <button type="button" data-slot="button" data-variant="ghost" data-size="icon-sm" aria-label=${label} class=${buttonClass({ variant: 'ghost', size: 'icon-sm' })}>
          ${icon}
        </button>
      </ui-tooltip-trigger>
      <ui-tooltip-content><p>${label}</p></ui-tooltip-content>
    </ui-tooltip>
  `;
}

// The settled turn. The kit does not parse Markdown, so the reply is written
// out the way a Markdown renderer would emit it, with the fence as a code
// block titled by its language.
export default function MessagePattern() {
  return html`
    <div class="mx-auto flex w-full max-w-md flex-col gap-8 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-2')}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>
              How do I add a settings dialog? It should open from the gear icon
              in the header.
            </div>
          </div>
          <div data-slot="message-footer" class=${messageFooterClass()}>
            ${MessageAction('Copy', CopyIcon())}
            ${MessageAction('Edit', PencilIcon())}
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-2')}>
          <div class="space-y-4">
            <p>Install Dialog, then open it from the gear button in <code class=${inlineCode}>site-header.tsx</code>.</p>
            <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
              <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
                <div data-slot="code-block-title" class=${codeBlockTitleClass()}>bash</div>
                <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
                  <ui-code-block-copy-button value=${command}></ui-code-block-copy-button>
                </div>
              </div>
              <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(command)}</code></pre>
            </div>
            <p>Wrap the button in a <code class=${inlineCode}>DialogTrigger</code> and put the settings form in <code class=${inlineCode}>DialogContent</code>. Focus moves into the dialog when it opens, and <strong>Esc</strong> closes it.</p>
          </div>
          <div data-slot="message-footer" class=${cn(messageFooterClass(), 'px-0')}>
            ${MessageAction('Copy', CopyIcon())}
            ${MessageAction('Good response', ThumbsUpIcon())}
            ${MessageAction('Bad response', ThumbsDownIcon())}
            ${MessageAction('Retry', RefreshCcwIcon())}
          </div>
        </div>
      </div>
    </div>
  `;
}
