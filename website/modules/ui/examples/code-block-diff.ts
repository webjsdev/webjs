import { html } from '@webjsdev/core';
import {
  codeBlockClass, codeBlockHeaderClass, codeBlockTitleClass, codeBlockActionsClass,
  codeBlockContentClass, codeBlockCodeClass, codeBlockLines, type CodeBlockLineVariant,
} from '#modules/ui/components/code-block.ts';

const patch = ` export function Greeting({ name }: { name: string }) {
-  return <p>Hello, {name}</p>
+  return <p className="text-sm text-muted-foreground">
+    Hello, {name}!
+  </p>
 }`;

function getVariant(line: string): CodeBlockLineVariant {
  if (line.startsWith('+')) {
    return 'added';
  }

  if (line.startsWith('-')) {
    return 'removed';
  }

  return 'default';
}

// The first character of each row is the diff marker. The line shows the
// rest, and the variant draws the marker.
const rows = patch.split('\n');
const variants = Object.fromEntries(rows.map((row, index) => [index + 1, getVariant(row)]));
const code = rows.map((row) => row.slice(1)).join('\n');

export default function CodeBlockDiff() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="code-block" data-variant="default" data-size="default" class=${codeBlockClass()}>
        <div data-slot="code-block-header" class=${codeBlockHeaderClass()}>
          <div data-slot="code-block-title" class=${codeBlockTitleClass()}>components/greeting.tsx</div>
          <div data-slot="code-block-actions" class=${codeBlockActionsClass()}>
            <ui-code-block-copy-button value=${patch}></ui-code-block-copy-button>
          </div>
        </div>
        <pre data-slot="code-block-content" tabindex="0" dir="ltr" style="counter-reset: line 0" class=${codeBlockContentClass()}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${codeBlockLines(code, { variants })}</code></pre>
      </div>
    </div>
  `;
}
