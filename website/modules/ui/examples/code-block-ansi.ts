import { html, type TemplateResult } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLineClass,
} from '#modules/ui/components/code-block.ts';
import { TerminalIcon } from '#lib/ui/lucide.ts';

const output = `$ pnpm test
\x1b[32m✓\x1b[39m src/format.test.ts \x1b[2m(4 tests)\x1b[22m
\x1b[32m✓\x1b[39m src/parse.test.ts \x1b[2m(7 tests)\x1b[22m
\x1b[31m✗\x1b[39m src/stream.test.ts \x1b[2m(3 tests | 1 failed)\x1b[22m

\x1b[31mAssertionError: expected 'hello' to be 'hello world'\x1b[39m

Tests  \x1b[31m1 failed\x1b[39m | \x1b[32m13 passed\x1b[39m (14)`;

const ESCAPES = /\x1b\[([\d;]*)m/g;
const COLORS: Record<string, string> = {
  31: 'text-red-600 dark:text-red-400',
  32: 'text-green-600 dark:text-green-400',
};

// The kit does not parse ANSI. This reads the few SGR codes the output uses
// (a colour, its reset, dim and its reset) into spans inside one line. Like
// shadcn's, the colours do not carry from one line to the next.
function ansiLine(line: string) {
  const parts: TemplateResult[] = [];
  let color = '';
  let dim = false;
  let last = 0;
  for (const match of line.matchAll(ESCAPES)) {
    const text = line.slice(last, match.index);
    if (text) parts.push(html`<span class=${[color, dim ? 'opacity-60' : ''].join(' ').trim() || null}>${text}</span>`);
    for (const code of match[1].split(';')) {
      if (code === '0' || code === '') { color = ''; dim = false; }
      else if (code === '2') dim = true;
      else if (code === '22') dim = false;
      else if (code === '39') color = '';
      else if (COLORS[code]) color = COLORS[code];
    }
    last = (match.index ?? 0) + match[0].length;
  }
  const rest = line.slice(last);
  if (rest) parts.push(html`<span class=${[color, dim ? 'opacity-60' : ''].join(' ').trim() || null}>${rest}</span>`);
  return html`<span data-slot="code-block-line" data-variant="default" class=${codeBlockLineClass()}><span data-slot="code-block-line-content" class="min-w-0">${parts.length ? parts : '\n'}</span></span>`;
}

export default function CodeBlockAnsi() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>
            ${TerminalIcon()}
            Terminal
          </div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${output.replace(ESCAPES, '')}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output.split('\n').map(ansiLine)}</code></pre>
      </div>
    </div>
  `;
}
