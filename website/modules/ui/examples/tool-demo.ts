import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { bubbleClass, bubbleContentClass } from '#modules/ui/components/bubble.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import {
  codeBlockClass, codeBlockContentClass, codeBlockCodeClass,
} from '#modules/ui/components/code-block.ts';
import { messageClass, messageContentClass } from '#modules/ui/components/message.ts';
import {
  traceClass, traceLineClass, traceIconClass, traceTitleClass,
  traceCollapsibleClass, traceCollapsibleTriggerClass, traceCollapsibleContentClass,
} from '#modules/ui/components/trace.ts';
import { ChevronRightIcon, TerminalIcon } from '#lib/ui/lucide.ts';

const question = 'Which package managers are installed?';
const answer = 'Node 24 and npm 11 are installed. pnpm is not.';

type ToolPart =
  | { state: 'output-available'; command: string; stdout: string }
  | { state: 'output-error'; command: string; errorText: string }
  | { state: 'input-available'; command: string };

const tools: ToolPart[] = [
  { state: 'output-available', command: 'node --version', stdout: 'v24.18.0' },
  { state: 'output-available', command: 'npm --version', stdout: '11.6.2' },
  { state: 'output-error', command: 'pnpm --version', errorText: 'command not found: pnpm' },
];

// One tool part as a row. A call with output expands to it, and a failed
// call starts open once the reply has finished. A call with no output yet is
// a plain line: running while the reply streams, failed once it has stopped.
function ToolRow(part: ToolPart, streaming: boolean) {
  if (part.state === 'output-available' || part.state === 'output-error') {
    const failed = part.state === 'output-error';
    return html`
      <details data-slot="trace-collapsible" ?open=${!streaming && failed} class=${cn(traceCollapsibleClass(), 'group/trace-collapsible')}>
        <summary data-slot="trace-collapsible-trigger" class=${traceCollapsibleTriggerClass()}>
          <span data-slot="trace-line" data-status=${failed ? 'error' : nothing} class=${traceLineClass()}>
            <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
            <span data-slot="trace-title" class=${traceTitleClass()}>${failed ? 'Failed to run' : 'Ran'} ${part.command}</span>
          </span>
          <span data-slot="trace-icon" aria-hidden="true" class=${cn(traceIconClass(), 'transition-transform group-open/trace-collapsible:rotate-90')}>${ChevronRightIcon()}</span>
        </summary>
        <div data-slot="trace-collapsible-content" class=${traceCollapsibleContentClass()}>
          <div data-slot="code-block" data-variant="default" data-size="sm" class=${codeBlockClass()}>
            <pre data-slot="code-block-content" data-wrap tabindex="0" dir="ltr" style="counter-reset: line 0" class=${cn(codeBlockContentClass(), 'max-h-64')}><code data-slot="code-block-code" class=${codeBlockCodeClass()}>${failed ? part.errorText : part.stdout}</code></pre>
          </div>
        </div>
      </details>
    `;
  }
  return html`<span data-slot="trace-line" data-status=${streaming ? 'running' : 'error'} class=${traceLineClass()}>
    <span data-slot="trace-icon" aria-hidden="true" class=${traceIconClass()}>${TerminalIcon()}</span>
    <span data-slot="trace-title" class=${traceTitleClass()}>${streaming ? 'Running' : 'Failed to run'} ${part.command}</span>
  </span>`;
}

// The conversation once the reply has finished streaming.
export default function ToolDemo() {
  return html`
    <div class="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
      <div data-slot="message" data-align="end" class=${messageClass()}>
        <div data-slot="message-content" class=${messageContentClass()}>
          <div data-slot="bubble" data-variant="muted" data-align="end" class=${bubbleClass({ variant: 'muted' })}>
            <div data-slot="bubble-content" class=${bubbleContentClass()}>${question}</div>
          </div>
        </div>
      </div>
      <div data-slot="message" data-align="start" class=${messageClass()}>
        <div data-slot="message-content" class=${cn(messageContentClass(), 'gap-4')}>
          <div data-slot="trace" class=${traceClass()}>
            ${tools.map((part) => ToolRow(part, false))}
          </div>
          <p>${answer}</p>
        </div>
      </div>
      <button type="button" data-slot="button" data-variant="outline" data-size="sm" class=${cn(buttonClass({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}>
        Replay
      </button>
    </div>
  `;
}
