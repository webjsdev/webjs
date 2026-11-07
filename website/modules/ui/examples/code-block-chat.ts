import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';

const code = `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    messages,
  })

  return result.toUIMessageStreamResponse()
}`;

export default function CodeBlockChat() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-4 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>How do I stream a response?</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-3')}>
          <p>Create a route handler that returns the stream:</p>
          <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
            <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
              <div data-slot="code-block-title" class=${codeBlockTitleClass()}>app/api/chat/route.ts</div>
              <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
                <ui-code-block-copy-button value=${code}></ui-code-block-copy-button>
              </div>
            </div>
            <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code)}</code></pre>
          </div>
          <p>The client reads it with useChat.</p>
        </div>
      </div>
    </div>
  `;
}
