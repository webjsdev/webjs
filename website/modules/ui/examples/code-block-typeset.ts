import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { FileCodeIcon } from '#lib/ui/lucide.ts';

const code = `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()
  const result = streamText({ model: "anthropic/claude-sonnet-4.5", messages })

  return result.toUIMessageStreamResponse()
}`;

export default function CodeBlockTypeset() {
  return html`
    <div class="typeset w-full max-w-md">
      <h3>Stream a response</h3>
      <p>
        Create a route handler that calls <code>streamText</code> and returns
        the stream to the client.
      </p>
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>
            ${FileCodeIcon()}
            app/api/chat/route.ts
          </div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${code}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code)}</code></pre>
      </div>
      <p>
        The <code>useChat</code> hook reads the stream on the client and renders
        the answer while it is written.
      </p>
    </div>
  `;
}
