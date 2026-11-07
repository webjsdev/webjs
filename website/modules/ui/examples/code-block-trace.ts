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

const output = `$ node --version
v24.18.0`;

const error = `$ pnpm dev
Error: listen EADDRINUSE: address already in use :::3000
    at Server.setupListenHandle [as _listen2] (node:net:1908:16)`;

// TraceCollapsible is a native <details>, open by default here. The chevron
// after the line turns while it is open.
export default function CodeBlockTrace() {
  return html`
    <div class="w-full max-w-md">
      <div data-slot="trace" class=${traceClass()}>
        <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
          <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
            <span data-slot="trace-line" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Ran node --version</span>
            </span>
            <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
          </summary>
          <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
            <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
              <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${output}</code></pre>
            </div>
          </div>
        </details>
        <details data-slot="trace-collapsible" open class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
          <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
            <span data-slot="trace-line" data-status="error" class=${traceLineClass()}>
              <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
              <span data-slot="trace-title" class=${traceTitleClass()}>Failed to run pnpm dev</span>
            </span>
            <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
          </summary>
          <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
            <div data-slot="code-block" data-variant="destructive" data-size="sm" class=${codeBlockClass({ variant: 'destructive' })}>
              <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${error}</code></pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  `;
}
