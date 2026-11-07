import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockActionsClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';

const output = `$ pnpm add ai @ai-sdk/react zod
Progress: resolved 412, reused 398, downloaded 14, added 14, done
dependencies:
+ @ai-sdk/react 3.0.12
+ ai 6.0.12
+ zod 4.1.12
Done in 2.8s using pnpm v10.18.0`;

export default function CodeBlockFloatingActions() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
          <ui-code-block-copy-button value=${output}></ui-code-block-copy-button>
        </div>
        <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output}</code></pre>
      </div>
    </div>
  `;
}
