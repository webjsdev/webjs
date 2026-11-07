import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';

const output = `Error: The model "anthropic/claude-sonnet-4.5" returned an error: Request too large. The prompt is 212,431 tokens and the context window is 200,000 tokens. Remove some messages or summarize the conversation and try again.`;

export default function CodeBlockWrap() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-4">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output}</code></pre>
      </div>
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output}</code></pre>
      </div>
    </div>
  `;
}
