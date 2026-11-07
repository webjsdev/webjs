import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';

const code = `{
  "location": "San Francisco",
  "temperature": 18,
  "unit": "celsius",
  "conditions": ["fog", "wind"]
}`;

// The kit ships no highlighter, so these lines are plain text. To colour
// them, put your highlighter's token spans inside each line span.
export default function CodeBlockHighlighting() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>getWeather output</div>
        </div>
        <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code)}</code></pre>
      </div>
    </div>
  `;
}
