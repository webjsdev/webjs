import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, TerminalIcon } from '#lib/ui/lucide.ts';

const LINT_OUTPUT = `> acme-chat@0.1.0 lint
> eslint .

app/api/chat/route.ts
  14:7  error  'model' is assigned a value but never used  no-unused-vars

components/chat.tsx
  42:5  error  React Hook useEffect has a missing dependency: 'messages'  react-hooks/exhaustive-deps

✖ 2 problems (2 errors, 0 warnings)

 ELIFECYCLE  Command failed with exit code 1.`;

export default function TerminalError() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      <span data-slot="trace-line" class=${traceLineClass()}>
        <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
        <span data-slot="trace-title" class=${traceTitleClass()}>Ran pnpm install</span>
      </span>
      <details data-slot="trace-collapsible" open class=${traceCollapsibleClass()}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>pnpm lint exited with code 1</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform [[open]>summary>&]:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
          <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
            <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${LINT_OUTPUT}</code></pre>
          </div>
        </div>
      </details>
    </div>
  `;
}
