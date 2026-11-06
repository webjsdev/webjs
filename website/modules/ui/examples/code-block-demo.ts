import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';
import { DownloadIcon, FileCodeIcon, WrapTextIcon } from '#lib/ui/lucide.ts';

const code = `import { streamText } from "ai"

export async function POST(request: Request) {
  const { messages } = await request.json()

  const result = streamText({
    model: "anthropic/claude-sonnet-4.5",
    system: "You are a helpful assistant. Answer in one short paragraph.",
    messages,
  })

  return result.toUIMessageStreamResponse()
}`;

export default function CodeBlockDemo() {
  return html`
    <div class="w-full max-w-lg">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>
            ${FileCodeIcon()}
            app/api/chat/route.ts
          </div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <button
              type="button"
              data-slot="button"
              data-variant="ghost"
              data-size="icon-xs"
              aria-label="Wrap lines"
              aria-pressed="false"
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
            <ui-code-block-copy-button value=${code}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" data-numbered tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code, { variants: { 6: 'highlighted', 7: 'highlighted', 8: 'highlighted', 9: 'highlighted', 10: 'highlighted' } })}</code></pre>
      </div>
    </div>
  `;
}
