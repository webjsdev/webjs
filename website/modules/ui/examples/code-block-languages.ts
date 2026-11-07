import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines,
} from '#modules/ui/components/code-block.ts';

const samples = [
  {
    language: 'css',
    title: 'app/globals.css',
    code: `@import "tailwindcss";

:root {
  --radius: 0.625rem;
}`,
  },
  {
    language: 'python',
    title: 'main.py',
    code: `def greet(name: str) -> str:
    return f"Hello, {name}!"`,
  },
  {
    language: 'text',
    title: 'notes.txt',
    code: 'A language that is not in the list renders as plain text.',
  },
];

export default function CodeBlockLanguages() {
  return html`
    <div class="flex w-full max-w-md flex-col gap-4">
      ${samples.map((sample) => html`
        <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
          <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
            <div data-slot="code-block-title" class=${codeBlockTitleClass()}>${sample.title}</div>
          </div>
          <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(sample.code)}</code></pre>
        </div>
      `)}
    </div>
  `;
}
