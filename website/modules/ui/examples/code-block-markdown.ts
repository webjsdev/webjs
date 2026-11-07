import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';

const question = 'How do I debounce a search input in React?';

const code = `export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])

  return debounced
}`;

const inlineCode = 'rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]';

// The settled answer. The kit does not parse Markdown: the paragraphs and the
// fenced code are written out here the way a Markdown renderer would emit
// them, with the fence rendered as a code block titled by its language.
function MarkdownCodeBlock(source: string, language: string) {
  return html`
    <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
      <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
        <div data-slot="code-block-title" class=${codeBlockTitleClass()}>${language || 'text'}</div>
        <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
          <ui-code-block-copy-button value=${source}></ui-code-block-copy-button>
        </div>
      </div>
      <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(source)}</code></pre>
    </div>
  `;
}

export default function CodeBlockMarkdown() {
  return html`
    <div class="flex min-h-112 w-full max-w-md flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>${question}</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div class="space-y-4">
            <p>
              Wrap the value in a <code class=${inlineCode}>useDebounce</code> hook. It returns the latest value once it stops changing for <code class=${inlineCode}>delay</code> milliseconds.
            </p>
            ${MarkdownCodeBlock(code, 'tsx')}
            <p>Pass the debounced value to your fetch instead of the raw input.</p>
          </div>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Replay
      </button>
    </div>
  `;
}
