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

// A row that expands to the command's output.
function outputRow(title: string, output: string, status: string | null) {
  return html`
    <details data-slot="trace-collapsible" class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
      <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
        <span data-slot="trace-line" data-status=${status} class=${traceLineClass()}>
          <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
          <span data-slot="trace-title" class=${traceTitleClass()}>${title}</span>
        </span>
        <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
      </summary>
      <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
        <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
          <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output}</code></pre>
        </div>
      </div>
    </details>
  `;
}

// A line with nothing to expand.
function line(title: string, status: string | null) {
  return html`<span data-slot="trace-line" data-status=${status} class=${traceLineClass()}>
    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
    <span data-slot="trace-title" class=${traceTitleClass()}>${title}</span>
  </span>`;
}

export default function ToolStates() {
  return html`
    <div data-slot="trace" class=${cn(traceClass(), 'max-w-sm')}>
      ${outputRow('Ran git status --short', ' M app/api/chat/route.ts\n M components/chat.tsx', null)}
      ${outputRow('Failed to run pnpm dev', 'Command timed out after 120 seconds.', 'error')}
      ${line('Denied rm -rf dist', null)}
      ${line('Running pnpm test', 'running')}
    </div>
  `;
}
